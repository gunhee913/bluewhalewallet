import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 60초
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessToken) {
    return NextResponse.json({
      success: false,
      error: 'BROWSERLESS_TOKEN not configured',
      address,
      totalAssets: null,
    });
  }

  let browser = null;

  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}&timeout=55000`,
    });

    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.goto(`${PUMPSPACE_URL}${address}`, {
      waitUntil: 'networkidle0',
      timeout: 45000,
    });

    // 금액이 로드될 때까지 폴링 (최대 30초)
    let totalAssets: string | null = null;

    for (let attempt = 0; attempt < 30; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      totalAssets = await page.evaluate(() => {
        const body = document.body.innerText;

        // Total Assets 근처에서 $1,000 이상인 금액 찾기
        const lines = body
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (line.includes('total') && line.includes('asset')) {
            for (let j = i; j < Math.min(i + 5, lines.length); j++) {
              const match = lines[j].match(/\$\s*[\d,]+(?:\.\d+)?/);
              if (match) {
                const amount = parseFloat(match[0].replace(/[$,\s]/g, ''));
                // $0이 아니고 실제 금액이면 반환
                if (amount > 0) {
                  return match[0].replace(/\s/g, '');
                }
              }
            }
          }
        }

        // 전체에서 $1,000 이상인 가장 큰 금액 찾기
        const allMatches = body.match(/\$\s*[\d,]+(?:\.\d+)?/g);
        if (allMatches && allMatches.length > 0) {
          let max = 0;
          let maxStr = '';
          for (const m of allMatches) {
            const num = parseFloat(m.replace(/[$,\s]/g, ''));
            if (num > max && num >= 1000) {
              max = num;
              maxStr = m.replace(/\s/g, '');
            }
          }
          if (maxStr) return maxStr;
        }

        return null;
      });

      // 금액을 찾으면 바로 종료
      if (totalAssets) {
        break;
      }
    }

    await browser.close();

    return NextResponse.json({
      success: true,
      address,
      totalAssets,
    });
  } catch (error) {
    console.error('Puppeteer Error:', error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        // ignore
      }
    }
    return NextResponse.json({
      success: false,
      address,
      totalAssets: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

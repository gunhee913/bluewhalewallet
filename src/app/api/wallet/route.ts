import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Pro 플랜 최대 60초
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  let browser = null;

  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1280, height: 800 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    await page.goto(`${PUMPSPACE_URL}${address}`, {
      waitUntil: 'networkidle0',
      timeout: 50000,
    });

    // 충분히 대기 (데이터 로딩)
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // 페이지 텍스트에서 금액 찾기
    const result = await page.evaluate(() => {
      const body = document.body.innerText;

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
              return {
                totalAssets: match[0].replace(/\s/g, ''),
              };
            }
          }
        }
      }

      const allMatches = body.match(/\$\s*[\d,]+(?:\.\d+)?/g);
      if (allMatches && allMatches.length > 0) {
        let max = 0;
        let maxStr = '';
        for (const m of allMatches) {
          const num = parseFloat(m.replace(/[$,\s]/g, ''));
          if (num > max) {
            max = num;
            maxStr = m.replace(/\s/g, '');
          }
        }
        return { totalAssets: maxStr };
      }

      return { totalAssets: null };
    });

    await browser.close();

    return NextResponse.json({
      success: true,
      address,
      totalAssets: result.totalAssets,
    });
  } catch (error) {
    console.error('Error:', error);
    if (browser) {
      await browser.close();
    }
    return NextResponse.json(
      {
        error: 'Failed to fetch wallet data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

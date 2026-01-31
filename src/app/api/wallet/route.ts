import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 60초
export const maxDuration = 60;

// Chromium 최적화 설정
chromium.setHeadlessMode = true;
chromium.setGraphicsMode = false;

async function getBrowser(): Promise<Browser> {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 800 },
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  let browser: Browser | null = null;

  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    );

    await page.goto(`${PUMPSPACE_URL}${address}`, {
      waitUntil: 'networkidle2',
      timeout: 45000,
    });

    // 데이터 로딩 대기
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 페이지 텍스트에서 금액 찾기
    const totalAssets = await page.evaluate(() => {
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
              return match[0].replace(/\s/g, '');
            }
          }
        }
      }

      // 전체에서 가장 큰 금액 찾기
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
        return maxStr || null;
      }

      return null;
    });

    await browser.close();

    return NextResponse.json({
      success: true,
      address,
      totalAssets,
    });
  } catch (error) {
    console.error('Puppeteer Error:', error);
    if (browser) {
      await browser.close();
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch wallet data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 60초
export const maxDuration = 60;

// 단일 페이지에서 Total Assets 추출
async function extractTotalAssets(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l);

    // Total Assets 찾기
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('total') && line.includes('asset')) {
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          const match = lines[j].match(/\$\s*[\d,]+(?:\.\d+)?/);
          if (match) {
            const amount = parseFloat(match[0].replace(/[$,\s]/g, ''));
            if (amount >= 1) {
              return match[0].replace(/\s/g, '');
            }
          }
        }
      }
    }

    // Total Token Value에서도 찾기
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('total') && line.includes('token') && line.includes('value')) {
        for (let j = i; j < Math.min(i + 3, lines.length); j++) {
          const match = lines[j].match(/\$\s*[\d,]+(?:\.\d+)?/);
          if (match) {
            const amount = parseFloat(match[0].replace(/[$,\s]/g, ''));
            if (amount >= 1) {
              return match[0].replace(/\s/g, '');
            }
          }
        }
      }
    }

    // 가장 큰 금액 반환
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
}

// 단일 지갑 처리 (기존 호환성)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const addresses = searchParams.get('addresses'); // 여러 주소 (콤마 구분)

  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessToken) {
    return NextResponse.json({
      success: false,
      error: 'BROWSERLESS_TOKEN not configured',
    });
  }

  // 여러 주소 일괄 처리
  if (addresses) {
    const addressList = addresses.split(',').map((a) => a.trim());
    const results: Record<string, string | null> = {};

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

      // 순차적으로 각 지갑 처리
      for (const addr of addressList) {
        try {
          await page.goto(`${PUMPSPACE_URL}${addr}`, {
            waitUntil: 'networkidle0',
            timeout: 15000,
          });

          // 3초 대기 후 추출
          await new Promise((resolve) => setTimeout(resolve, 3000));
          
          let totalAssets = await extractTotalAssets(page);
          
          // 못 찾으면 2초 더 대기 후 재시도
          if (!totalAssets) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            totalAssets = await extractTotalAssets(page);
          }

          results[addr] = totalAssets;
        } catch (err) {
          console.error(`Error fetching ${addr}:`, err);
          results[addr] = null;
        }
      }

      await browser.close();

      return NextResponse.json({
        success: true,
        results,
      });
    } catch (error) {
      console.error('Batch Puppeteer Error:', error);
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          // ignore
        }
      }
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results: {},
      });
    }
  }

  // 단일 주소 처리
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
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
      timeout: 30000,
    });

    // 5초 대기 후 추출
    await new Promise((resolve) => setTimeout(resolve, 5000));

    let totalAssets = await extractTotalAssets(page);

    // 못 찾으면 3초 더 대기 후 재시도
    if (!totalAssets) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      totalAssets = await extractTotalAssets(page);
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

import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  let browser = null;

  try {
    // Vercel 서버리스 환경용 설정
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
      timeout: 60000,
    });

    // 충분히 대기 (데이터 로딩)
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // 페이지 텍스트에서 금액 찾기
    const result = await page.evaluate(() => {
      const body = document.body.innerText;

      // Total Assets 찾기
      const lines = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('total') && line.includes('asset')) {
          // 다음 몇 줄에서 금액 찾기 ($ 뒤에 공백 허용)
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            const match = lines[j].match(/\$\s*[\d,]+(?:\.\d+)?/);
            if (match) {
              // 공백 제거하고 반환
              return {
                totalAssets: match[0].replace(/\s/g, ''),
                foundAt: lines[j],
              };
            }
          }
        }
      }

      // $ 패턴으로 전체 검색 (공백 허용)
      const allMatches = body.match(/\$\s*[\d,]+(?:\.\d+)?/g);
      if (allMatches && allMatches.length > 0) {
        // 가장 큰 금액 찾기
        let max = 0;
        let maxStr = '';
        for (const m of allMatches) {
          const num = parseFloat(m.replace(/[$,\s]/g, ''));
          if (num > max) {
            max = num;
            maxStr = m.replace(/\s/g, '');
          }
        }
        return { totalAssets: maxStr, foundAt: 'max value' };
      }

      return { totalAssets: null, bodyPreview: body.slice(0, 500) };
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

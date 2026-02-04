import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

export const maxDuration = 120;

// GET: 페이지 텍스트 디버그
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address') || '0x22BA71BB6C79cC15f3878f5dFbc262BBB28e7770';

  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessToken) {
    return NextResponse.json({ error: 'BROWSERLESS_TOKEN not configured' });
  }

  let browser = null;
  let page = null;

  try {
    console.log('Connecting to browser...');
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });

    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const url = `${PUMPSPACE_URL}${address}`;
    console.log('Navigating to:', url);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // 10초 대기 (동적 콘텐츠 로딩)
    await new Promise((r) => setTimeout(r, 10000));

    // 페이지 텍스트 추출
    const pageData = await page.evaluate(() => {
      const body = document.body.innerText;
      const lines = body.split('\n').map(l => l.trim()).filter(l => l);
      
      // SHELL 관련 부분 찾기
      const shellRelated: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toUpperCase().includes('SHELL')) {
          // SHELL 전후 10줄 추출
          const start = Math.max(0, i - 5);
          const end = Math.min(lines.length, i + 15);
          shellRelated.push('--- SHELL found at line ' + i + ' ---');
          for (let j = start; j < end; j++) {
            shellRelated.push(`[${j}] ${lines[j]}`);
          }
          shellRelated.push('---');
        }
      }
      
      // Token Assets 섹션 찾기
      const tokenAssetsRelated: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Token Assets') || lines[i].includes('token assets')) {
          const start = i;
          const end = Math.min(lines.length, i + 50);
          tokenAssetsRelated.push('--- Token Assets section ---');
          for (let j = start; j < end; j++) {
            tokenAssetsRelated.push(`[${j}] ${lines[j]}`);
          }
          break;
        }
      }
      
      return {
        totalLines: lines.length,
        first50Lines: lines.slice(0, 50),
        shellRelated,
        tokenAssetsRelated,
        allLines: lines, // 전체 라인
      };
    });

    return NextResponse.json({
      success: true,
      address,
      pageData,
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    if (page) {
      try { await page.close(); } catch (e) { /* ignore */ }
    }
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
}

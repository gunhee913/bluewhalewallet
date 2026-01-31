import { NextResponse } from 'next/server';
import puppeteer from 'puppeteer-core';

export const maxDuration = 120;

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const PUMPSPACE_URL = `https://pumpspace.io/wallet/detail?account=${BURN_ADDRESS}`;

// 찾으려는 토큰들
const TOKENS = ['sBWPM', 'sADOL', 'CLAM', 'PEARL', 'SHELL', 'CORAL', 'AQUA1'];

export async function GET() {
  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessToken) {
    return NextResponse.json({ success: false, error: 'BROWSERLESS_TOKEN not configured' });
  }

  let browser = null;

  try {
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    console.log('Navigating to:', PUMPSPACE_URL);
    await page.goto(PUMPSPACE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    // 페이지 로드 대기
    await new Promise((r) => setTimeout(r, 10000));

    // 페이지 전체 텍스트 가져오기
    const pageText = await page.evaluate(() => document.body.innerText);

    // 토큰별로 관련 텍스트 찾기
    const tokenInfo: Record<string, string[]> = {};
    const lines = pageText.split('\n').map((l) => l.trim()).filter((l) => l);

    for (const token of TOKENS) {
      tokenInfo[token] = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(token)) {
          // 토큰 발견 시 앞뒤 5줄 포함
          const start = Math.max(0, i - 3);
          const end = Math.min(lines.length, i + 10);
          tokenInfo[token] = lines.slice(start, end);
          break;
        }
      }
    }

    // HTML 구조도 확인 (토큰 카드 부분)
    const htmlSnippet = await page.evaluate(() => {
      // 토큰 테이블이나 리스트 찾기
      const tables = document.querySelectorAll('table');
      const divs = document.querySelectorAll('[class*="token"], [class*="asset"], [class*="holding"]');
      
      let html = '';
      if (tables.length > 0) {
        html += 'Tables found: ' + tables.length + '\n';
        html += tables[0]?.outerHTML?.slice(0, 2000) || '';
      }
      if (divs.length > 0) {
        html += '\nToken/Asset divs found: ' + divs.length;
      }
      
      return html || 'No specific structures found';
    });

    await page.close();
    await browser.close();

    return NextResponse.json({
      success: true,
      pageTextLength: pageText.length,
      pageTextPreview: pageText.slice(0, 3000),
      tokenInfo,
      htmlSnippet: htmlSnippet.slice(0, 1500),
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('Browser close error:', e);
      }
    }
  }
}

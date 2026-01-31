import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 60초
export const maxDuration = 60;

// 서버 측 메모리 캐시 (5분)
const CACHE_DURATION = 5 * 60 * 1000;
const walletCache: Map<string, { totalAssets: string | null; timestamp: number }> = new Map();

// 전체 지갑 데이터 캐시
let batchCache: { data: Record<string, string | null>; timestamp: number } | null = null;

// 단일 페이지에서 Total Assets 추출
async function extractTotalAssets(page: Page): Promise<string | null> {
  return await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').map((l) => l.trim()).filter((l) => l);

    // Total Assets 찾기 (금액 제한 없음 - $0도 OK)
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

    // Total Token Value도 확인
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (line.includes('total') && line.includes('token') && line.includes('value')) {
        for (let j = i; j < Math.min(i + 5, lines.length); j++) {
          const match = lines[j].match(/\$\s*[\d,]+(?:\.\d+)?/);
          if (match) {
            return match[0].replace(/\s/g, '');
          }
        }
      }
    }

    // 폴백: 페이지에서 첫 번째 $ 금액 찾기
    const firstAmount = body.match(/\$[\d,]+(?:\.\d+)?/);
    if (firstAmount) {
      return firstAmount[0];
    }
    
    return '$0';
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 배치 모드: 여러 주소를 한번에
  const addressesParam = searchParams.get('addresses');
  
  if (addressesParam) {
    const addresses = addressesParam.split(',').map(a => a.trim().toLowerCase());
    
    // 캐시 확인 - 5분 이내면 캐시 반환
    if (batchCache && Date.now() - batchCache.timestamp < CACHE_DURATION) {
      console.log('Returning cached batch data');
      return NextResponse.json({
        success: true,
        results: batchCache.data,
        cached: true,
      });
    }
    
    const browserlessToken = process.env.BROWSERLESS_TOKEN;
    
    if (!browserlessToken) {
      return NextResponse.json({
        success: false,
        error: 'BROWSERLESS_TOKEN not configured',
        results: {},
      });
    }
    
    const results: Record<string, string | null> = {};
    let browser = null;
    
    try {
      // 재시도 로직 (최대 3번)
      let connected = false;
      let retries = 0;
      
      while (!connected && retries < 3) {
        try {
          browser = await puppeteer.connect({
            browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}&timeout=55000`,
          });
          connected = true;
        } catch (e) {
          retries++;
          console.log(`Connection attempt ${retries} failed, waiting...`);
          if (retries < 3) {
            await new Promise(r => setTimeout(r, 2000 * retries)); // 점점 길게 대기
          }
        }
      }
      
      if (!browser) {
        throw new Error('Failed to connect after 3 retries');
      }
      
      const page = await browser.newPage();
      
      // 리소스 차단
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      // 각 주소 순차 처리
      for (const address of addresses) {
        try {
          const url = `${PUMPSPACE_URL}${address}`;
          await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
          
          // 데이터 로딩 대기
          await new Promise(r => setTimeout(r, 3000));
          
          const totalAssets = await extractTotalAssets(page);
          results[address] = totalAssets;
          
          console.log(`Fetched ${address}: ${totalAssets}`);
        } catch (err) {
          console.error(`Error fetching ${address}:`, err);
          results[address] = null;
        }
      }
      
      // 캐시 저장
      batchCache = {
        data: results,
        timestamp: Date.now(),
      };
      
      return NextResponse.json({
        success: true,
        results,
        cached: false,
      });
    } catch (error) {
      console.error('Batch Puppeteer Error:', error);
      
      // 에러 시 이전 캐시가 있으면 반환
      if (batchCache) {
        return NextResponse.json({
          success: true,
          results: batchCache.data,
          cached: true,
          stale: true,
        });
      }
      
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        results: {},
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
  
  // 단일 주소 모드
  const address = searchParams.get('address')?.toLowerCase();
  
  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }
  
  // 개별 캐시 확인
  const cached = walletCache.get(address);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return NextResponse.json({
      success: true,
      address,
      totalAssets: cached.totalAssets,
      cached: true,
    });
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
    
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const type = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(type)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    const url = `${PUMPSPACE_URL}${address}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    await new Promise(r => setTimeout(r, 5000));
    
    const totalAssets = await extractTotalAssets(page);
    
    // 캐시 저장
    walletCache.set(address, { totalAssets, timestamp: Date.now() });
    
    return NextResponse.json({
      success: true,
      address,
      totalAssets,
      cached: false,
    });
  } catch (error) {
    console.error('Puppeteer Error:', error);
    
    // 에러 시 이전 캐시 반환
    if (cached) {
      return NextResponse.json({
        success: true,
        address,
        totalAssets: cached.totalAssets,
        cached: true,
        stale: true,
      });
    }
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      address,
      totalAssets: null,
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

import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 60초
export const maxDuration = 60;

// Supabase 클라이언트 (lazy initialization)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// Total Assets 추출 (폴링으로 실제 금액이 나올 때까지 대기)
async function extractTotalAssets(page: Page): Promise<string | null> {
  // 최대 15초 동안 폴링 (1초 간격)
  for (let attempt = 0; attempt < 15; attempt++) {
    const result = await page.evaluate(() => {
      const body = document.body.innerText;
      
      // 디버그: 페이지 내용 일부 출력
      console.log('Page content length:', body.length);
      console.log('First 500 chars:', body.substring(0, 500));
      
      // 방법 1: "Total Assets" 텍스트 근처에서 찾기
      const totalAssetsMatch = body.match(/Total\s*Assets[\s\S]{0,50}?\$\s*([\d,]+(?:\.\d+)?)/i);
      if (totalAssetsMatch) {
        const amount = '$' + totalAssetsMatch[1];
        const numericValue = parseFloat(totalAssetsMatch[1].replace(/,/g, ''));
        if (numericValue > 0) {
          return { amount, method: 'regex1' };
        }
      }
      
      // 방법 2: 모든 $ 금액 중 가장 큰 것 찾기
      const allAmounts = body.match(/\$\s*[\d,]+(?:\.\d+)?/g);
      if (allAmounts && allAmounts.length > 0) {
        let maxAmount = '';
        let maxValue = 0;
        for (const amt of allAmounts) {
          const val = parseFloat(amt.replace(/[$,\s]/g, ''));
          if (val > maxValue) {
            maxValue = val;
            maxAmount = amt.replace(/\s/g, '');
          }
        }
        if (maxValue > 0) {
          return { amount: maxAmount, method: 'max', allAmounts };
        }
      }
      
      return { amount: null, method: 'none', bodyPreview: body.substring(0, 300) };
    });

    console.log(`Attempt ${attempt + 1}:`, JSON.stringify(result));

    if (result && result.amount) {
      console.log(`Found Total Assets after ${attempt + 1} attempts: ${result.amount} (method: ${result.method})`);
      return result.amount;
    }

    // 1초 대기 후 재시도
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 15초 후에도 못 찾으면 $0 반환
  console.log('Could not find Total Assets after 15 attempts');
  return '$0';
}

// GET: URL 파라미터로 주소 받기
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const addressesParam = searchParams.get('addresses');
  const addresses = addressesParam ? addressesParam.split(',').map(a => a.trim()) : [];
  return handleRefresh(addresses);
}

// POST: Body로 주소 받기
export async function POST(request: NextRequest) {
  const body = await request.json();
  const addresses: string[] = body.addresses || [];
  return handleRefresh(addresses);
}

// 실제 스크래핑 로직
async function handleRefresh(addresses: string[]) {

  if (addresses.length === 0) {
    return NextResponse.json({ error: 'Addresses required' }, { status: 400 });
  }

  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessToken) {
    return NextResponse.json({
      success: false,
      error: 'BROWSERLESS_TOKEN not configured',
    });
  }

  let browser = null;
  const results: Record<string, string | null> = {};

  try {
    // Browserless 연결
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}&timeout=55000`,
    });

    const page = await browser.newPage();

    // 리소스 차단 (속도 향상)
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
        console.log(`Navigating to ${url}`);
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });

        const totalAssets = await extractTotalAssets(page);
        results[address.toLowerCase()] = totalAssets;

        console.log(`Result for ${address}: ${totalAssets}`);
      } catch (err) {
        console.error(`Error fetching ${address}:`, err);
        results[address.toLowerCase()] = null;
      }
    }

    // Supabase에 저장
    const now = new Date().toISOString();
    const upsertData = Object.entries(results).map(([address, total_assets]) => ({
      address: address.toLowerCase(),
      total_assets,
      updated_at: now,
    }));

    const supabase = getSupabase();
    const { error: upsertError } = await supabase
      .from('wallet_assets')
      .upsert(upsertData, { onConflict: 'address' });

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Data refreshed and saved',
    });
  } catch (error) {
    console.error('Puppeteer Error:', error);
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

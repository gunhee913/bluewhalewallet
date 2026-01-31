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
  // 최대 10초 동안 폴링 (1초 간격)
  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await page.evaluate(() => {
      const body = document.body.innerText;
      const lines = body.split('\n').map((l) => l.trim()).filter((l) => l);

      // Total Assets 찾기
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase();
        if (line.includes('total') && line.includes('asset')) {
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            const match = lines[j].match(/\$\s*[\d,]+(?:\.\d+)?/);
            if (match) {
              const amount = match[0].replace(/\s/g, '');
              const numericValue = parseFloat(amount.replace(/[$,]/g, ''));
              // $0이 아닌 실제 금액만 반환
              if (numericValue > 0) {
                return amount;
              }
            }
          }
        }
      }
      return null;
    });

    if (result) {
      console.log(`Found Total Assets after ${attempt + 1} attempts: ${result}`);
      return result;
    }

    // 1초 대기 후 재시도
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 10초 후에도 못 찾으면 $0 반환 (실제로 $0인 경우 대비)
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

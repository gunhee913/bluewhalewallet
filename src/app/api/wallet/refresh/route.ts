import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 60초
export const maxDuration = 60;

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Total Assets 추출
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
            return match[0].replace(/\s/g, '');
          }
        }
      }
    }

    // 폴백: 첫 번째 $ 금액
    const firstAmount = body.match(/\$[\d,]+(?:\.\d+)?/);
    return firstAmount ? firstAmount[0] : '$0';
  });
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
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 3000));

        const totalAssets = await extractTotalAssets(page);
        results[address.toLowerCase()] = totalAssets;

        console.log(`Fetched ${address}: ${totalAssets}`);
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

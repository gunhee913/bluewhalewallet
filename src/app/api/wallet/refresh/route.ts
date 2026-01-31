import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// 지갑 주소 그룹 (2개씩 나눠서 다른 시간에 처리)
const WALLET_GROUPS: Record<string, string[]> = {
  '1': [
    '0x3654378aa2deb0860c2e5c7906471c8704c44c6f', // 바이백펀드
    '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7', // 아돌펀드
  ],
  '2': [
    '0xD57423c54F188220862391A069a2942c725ee37B', // Aqua1 펀드
    '0xfd48a5FFE5127896E93BAA8074CE98c5a999Ea97', // v3 수수료 펀드
  ],
  '3': [
    '0x000000000000000000000000000000000000dEaD', // 소각 지갑
    '0x525e7f0a5d3fd6169d6ec35288104d52bf3bb95f', // 팀 지갑
  ],
};

// 모든 지갑 주소
const ALL_ADDRESSES = Object.values(WALLET_GROUPS).flat();

// Supabase 클라이언트 (lazy initialization)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// Total Assets 추출 - 최적화된 버전
async function extractTotalAssets(page: Page): Promise<string | null> {
  // 페이지 로드 후 8초 대기
  await new Promise((r) => setTimeout(r, 8000));
  
  // 최대 10초 동안 폴링 (1초 간격)
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim());
        
        // 1. "Total Assets" 줄 찾고 다음 줄에서 금액 추출
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (line === 'total assets' || line.includes('total assets')) {
            for (let j = i; j < Math.min(i + 5, lines.length); j++) {
              const searchLine = lines[j];
              const match = searchLine.match(/\$\s*([\d,]+(?:\.\d+)?)/);
              if (match && match[1]) {
                const val = parseFloat(match[1].replace(/,/g, ''));
                if (val >= 10) {
                  return '$' + match[1];
                }
              }
            }
          }
        }
        
        // 2. 정규식으로 "Total Assets" 근처 금액 찾기
        const patterns = [
          /Total\s*Assets[\s\S]{0,30}?\$\s*([\d,]+(?:\.\d+)?)/i,
          /Total\s*Assets[:\s]*\$?\s*([\d,]+(?:\.\d+)?)/i,
        ];
        
        for (const pattern of patterns) {
          const match = body.match(pattern);
          if (match && match[1]) {
            const numValue = parseFloat(match[1].replace(/,/g, ''));
            if (numValue >= 10) {
              return '$' + match[1];
            }
          }
        }
        
        // 3. 페이지의 모든 $ 금액 중 가장 큰 것 (fallback)
        const allAmounts = body.match(/\$\s*([\d,]+(?:\.\d+)?)/g);
        if (allAmounts && allAmounts.length > 0) {
          let maxAmount = '$0';
          let maxValue = 0;
          for (const amt of allAmounts) {
            const val = parseFloat(amt.replace(/[$,\s]/g, ''));
            if (val > maxValue) {
              maxValue = val;
              maxAmount = '$' + val.toLocaleString();
            }
          }
          if (maxValue >= 10) {
            return maxAmount;
          }
        }
        
        return null;
      });

      if (result && result !== '$0') {
        console.log(`Found: ${result} (attempt ${attempt + 1})`);
        return result;
      }
    } catch (e) {
      console.error(`Attempt ${attempt + 1} error:`, e);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return null; // 실패 시 null 반환 (기존 값 유지용)
}

// 단일 지갑 크롤링 (재시도 로직 포함)
async function fetchSingleWallet(
  address: string, 
  browserlessToken: string,
  retryCount: number = 0
): Promise<string | null> {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[${address}] Connecting... (attempt ${retryCount + 1})`);
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    
    page = await browser.newPage();
    
    await page.setViewport({ width: 1280, height: 720 });
    
    const url = `${PUMPSPACE_URL}${address}`;
    console.log(`[${address}] Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 45000 
    });

    const totalAssets = await extractTotalAssets(page);
    console.log(`[${address}] Result: ${totalAssets}`);
    
    return totalAssets;

  } catch (err) {
    console.error(`[${address}] Error:`, err);
    
    // 재시도 (최대 1회)
    if (retryCount < 1) {
      console.log(`[${address}] Retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
      return fetchSingleWallet(address, browserlessToken, retryCount + 1);
    }
    
    return null;
  } finally {
    if (page) {
      try { await page.close(); } catch (e) { /* ignore */ }
    }
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
}

// GET: 지갑 새로고침 (Cron에서 호출)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const groupParam = searchParams.get('group');
  const addressesParam = searchParams.get('addresses');
  
  let addresses: string[];
  
  if (addressesParam) {
    addresses = addressesParam.split(',').map(a => a.trim());
  } else if (groupParam && WALLET_GROUPS[groupParam]) {
    addresses = WALLET_GROUPS[groupParam];
    console.log(`Processing group ${groupParam}:`, addresses);
  } else {
    addresses = ALL_ADDRESSES;
  }
  
  return handleRefresh(addresses);
}

// POST: Body로 주소 받기
export async function POST(request: NextRequest) {
  const body = await request.json();
  const addresses: string[] = body.addresses || ALL_ADDRESSES;
  return handleRefresh(addresses);
}

// 실제 스크래핑 로직
async function handleRefresh(addresses: string[]) {
  console.log('Starting refresh for addresses:', addresses);

  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessToken) {
    return NextResponse.json({
      success: false,
      error: 'BROWSERLESS_TOKEN not configured',
    });
  }

  const results: Record<string, string | null> = {};

  // 각 지갑 순차 처리
  for (const address of addresses) {
    const totalAssets = await fetchSingleWallet(address, browserlessToken);
    results[address.toLowerCase()] = totalAssets;
    
    // 다음 요청 전 3초 대기 (최적화: 5초 → 3초)
    await new Promise((r) => setTimeout(r, 3000));
  }

  // Supabase에 저장 (null이 아닌 것만)
  const now = new Date().toISOString();
  const upsertData = Object.entries(results)
    .filter(([, total_assets]) => total_assets !== null) // null은 저장하지 않음 (기존 값 유지)
    .map(([address, total_assets]) => ({
      address: address.toLowerCase(),
      total_assets,
      updated_at: now,
    }));

  console.log('Saving to Supabase:', upsertData);

  if (upsertData.length > 0) {
    try {
      const supabase = getSupabase();
      const { error: upsertError } = await supabase
        .from('wallet_assets')
        .upsert(upsertData, { onConflict: 'address' });

      if (upsertError) {
        console.error('Supabase upsert error:', upsertError);
      } else {
        console.log('Saved to Supabase successfully');
      }
    } catch (dbError) {
      console.error('Database error:', dbError);
    }
  }

  return NextResponse.json({
    success: true,
    results,
    message: 'Data refreshed and saved',
  });
}

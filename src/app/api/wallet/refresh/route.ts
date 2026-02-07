import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// 지갑 주소 그룹 (1개씩 분리해서 안정적으로 처리)
const WALLET_GROUPS: Record<string, string[]> = {
  '1': ['0x3654378aa2deb0860c2e5c7906471c8704c44c6f'], // 바이백펀드 (메인)
  '2': ['0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7'], // 아돌펀드 (메인)
  '3': ['0xD57423c54F188220862391A069a2942c725ee37B'], // Aqua1 펀드
  '4': ['0xfd48a5FFE5127896E93BAA8074CE98c5a999Ea97'], // v3 SHELL 펀드(40%)
  '5': ['0x52FB7d3ab53d5a8d348B15ea7E3f7bfE35dD35F1'], // v3 수수료 펀드(60%)
  '6': ['0x000000000000000000000000000000000000dEaD'], // 소각 지갑
  '7': ['0x525e7f0a5d3fd6169d6ec35288104d52bf3bb95f'], // 팀 지갑
  '8': ['0xDf3723f75a8B3E10Fe0093991C961d58A5549fDE'], // 바이백 AI(1)
  '9': ['0x8c29527976b07F6e9c5Fa7705a4997C3B9e7fdD4'], // 바이백 AI(2)
  '10': ['0xF7E18a70C31C5E8D89e00a5a5e81Fc44E607513B'], // 바이백 AI(3)
  '11': ['0x7c6d9059792C711229Ca7295eaa8916cF2a33776'], // 바이백 AI(4)
  '12': ['0x61CA700c0b004029Fc4A80C409C9829ABe79528D'], // 바이백 AI(5)
  '13': ['0xa617A017A09CFEc5d22598e92C252dfBF327fF91'], // 바이백 AI(6)
  '14': ['0x981086C666D3EB8A11f122B001B58346A6422B80'], // 바이백 AI(7)
  '15': ['0x5DEf16B5E663baEb75C44B30c273281aFD5Fd342'], // 바이백 AI(8)
  '16': ['0xe2E6252aBf18680169f8e95aa8f2b5c5E6c05390'], // 아돌 AI(1)
  '17': ['0x8E63231be79fFDFECf46b13FFDE1881fD9C7e231'], // 아돌 AI(2)
  '18': ['0x9Bd2c37535F41cE4FC373cAcee1F7Bd023DC5b9A'], // 아돌 AI(3)
  '19': ['0xC81A059E9A2185A97925d6B7b5D527294c439625'], // 아돌 AI(4)
  '20': ['0x021f53A57F99413A83298187C139f647F95F5133'], // v2 수수료 펀드
  '21': ['0x6A3a608213a6597aaC0d7BC08da8e7f77d6FaEdB'], // bUSDC (실험실)
  '22': ['0xa7f39e0d389eCF0cADFb8b940015300D4010A58C'], // bAUSD (실험실)
  '23': ['0x620298587246547da70B8c16d3aA0C92F38E243f'], // BTC.b-WETH.e (실험실)
  '24': ['0xAFa948cf1e722E83572068A826f146Fbe134cF77'], // BTC.b-XAUt (실험실)
  '25': ['0xdA6C0aFb267072F8fF6FC4F207b992729F4a4e15'], // CORAL 펀드
  '26': ['0x22BA71BB6C79cC15f3878f5dFbc262BBB28e7770'], // BTC 펀드 (실험실)
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
    
    // 재시도 (최대 2회)
    if (retryCount < 2) {
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
    
    // 다음 요청 전 30초 대기 (rate limit 방지)
    await new Promise((r) => setTimeout(r, 30000));
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
      
      // 1. wallet_assets 업데이트 (현재 자산)
      const { error: upsertError } = await supabase
        .from('wallet_assets')
        .upsert(upsertData, { onConflict: 'address' });

      if (upsertError) {
        console.error('Supabase upsert error:', upsertError);
      } else {
        console.log('Saved to wallet_assets successfully');
      }
      
      // 2. wallet_assets_history에도 저장 (매번 업데이트, 같은 날짜면 덮어쓰기)
      // 한국 시간 기준 날짜 (UTC+9)
      const koreaDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
      const today = koreaDate.toISOString().split('T')[0];
      const historyData = upsertData.map((item) => ({
        address: item.address,
        total_assets: item.total_assets,
        recorded_at: today,
      }));
      
      const { error: historyError } = await supabase
        .from('wallet_assets_history')
        .upsert(historyData, { onConflict: 'address,recorded_at' });
      
      if (historyError) {
        console.error('History save error:', historyError);
      } else {
        console.log('Saved to wallet_assets_history successfully');
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

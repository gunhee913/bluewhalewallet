import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// SHELL CLUB 멤버 지갑들
const SHELL_CLUB_MEMBERS = [
  { name: '멤버1', address: '0x22BA71BB6C79cC15f3878f5dFbc262BBB28e7770' },
];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// SHELL 토큰 보유량 추출
async function extractShellAmount(page: Page): Promise<{ amount: number; value: number; price: number } | null> {
  // 페이지 로드 후 8초 대기
  await new Promise((r) => setTimeout(r, 8000));
  
  // 최대 10초 동안 폴링 (1초 간격)
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim());
        
        // SHELL 토큰 찾기
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // "SHELL" 이라는 텍스트가 있는 줄 찾기
          if (line === 'SHELL' || line.match(/^SHELL$/i)) {
            // SHELL 줄 근처에서 수량과 가치 찾기
            let amount = 0;
            let value = 0;
            let price = 0;
            
            // 이전/이후 5줄 내에서 숫자 찾기
            for (let j = Math.max(0, i - 5); j < Math.min(lines.length, i + 10); j++) {
              const searchLine = lines[j];
              
              // 가격 찾기 (예: $0.0005)
              const priceMatch = searchLine.match(/\$\s*(0\.\d+)/);
              if (priceMatch) {
                price = parseFloat(priceMatch[1]);
              }
              
              // 수량 찾기 (큰 숫자, 콤마 포함 가능)
              const amountMatch = searchLine.match(/^([\d,]+(?:\.\d+)?)$/);
              if (amountMatch) {
                const num = parseFloat(amountMatch[1].replace(/,/g, ''));
                // 100 이상의 큰 숫자는 보유량으로 간주
                if (num >= 100 && num > amount) {
                  amount = num;
                }
              }
              
              // 가치 찾기 (예: $1,234.56)
              const valueMatch = searchLine.match(/\$\s*([\d,]+(?:\.\d+)?)/);
              if (valueMatch) {
                const val = parseFloat(valueMatch[1].replace(/,/g, ''));
                // $10 이상이면 가치로 간주
                if (val >= 10 && val > value && val < 1000000000) {
                  value = val;
                }
              }
            }
            
            if (amount > 0) {
              return { amount, value, price };
            }
          }
        }
        
        // 정규식으로 SHELL 근처 찾기
        const shellPattern = /SHELL[\s\S]{0,200}?([\d,]+(?:\.\d+)?)\s*(?:SHELL)?[\s\S]{0,50}?\$\s*([\d,]+(?:\.\d+)?)/i;
        const match = body.match(shellPattern);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          const value = parseFloat(match[2].replace(/,/g, ''));
          if (amount >= 100) {
            return { amount, value, price: value / amount };
          }
        }
        
        return null;
      });

      if (result && result.amount > 0) {
        console.log(`Found SHELL: ${result.amount} (value: $${result.value}) (attempt ${attempt + 1})`);
        return result;
      }
    } catch (e) {
      console.error(`Attempt ${attempt + 1} error:`, e);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return null;
}

// 단일 지갑 크롤링
async function fetchShellForWallet(
  address: string, 
  browserlessToken: string,
  retryCount: number = 0
): Promise<{ amount: number; value: number; price: number } | null> {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[SHELL] ${address} Connecting... (attempt ${retryCount + 1})`);
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    const url = `${PUMPSPACE_URL}${address}`;
    console.log(`[SHELL] Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 45000 
    });

    const shellData = await extractShellAmount(page);
    console.log(`[SHELL] ${address} Result:`, shellData);
    
    return shellData;

  } catch (err) {
    console.error(`[SHELL] ${address} Error:`, err);
    
    // 재시도 (최대 2회)
    if (retryCount < 2) {
      console.log(`[SHELL] ${address} Retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
      return fetchShellForWallet(address, browserlessToken, retryCount + 1);
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

// GET: SHELL CLUB 새로고침 (Cron에서 호출)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const addressParam = searchParams.get('address');
  
  // 특정 주소만 처리하거나 전체 멤버 처리
  const addresses = addressParam 
    ? [addressParam] 
    : SHELL_CLUB_MEMBERS.map(m => m.address);
  
  console.log('Starting SHELL CLUB refresh for:', addresses);

  const browserlessToken = process.env.BROWSERLESS_TOKEN;

  if (!browserlessToken) {
    return NextResponse.json({
      success: false,
      error: 'BROWSERLESS_TOKEN not configured',
    });
  }

  const results: Record<string, { amount: number; value: number; price: number } | null> = {};

  // 각 지갑 순차 처리
  for (const address of addresses) {
    const shellData = await fetchShellForWallet(address, browserlessToken);
    results[address.toLowerCase()] = shellData;
    
    // 다음 요청 전 30초 대기 (rate limit 방지)
    if (addresses.length > 1) {
      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  // Supabase에 저장
  const koreaDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = koreaDate.toISOString().split('T')[0];
  
  const upsertData = Object.entries(results)
    .filter(([, data]) => data !== null)
    .map(([address, data]) => ({
      address: address.toLowerCase(),
      shell_amount: data!.amount,
      shell_value: data!.value,
      shell_price: data!.price,
      recorded_at: today,
    }));

  console.log('Saving to Supabase:', upsertData);

  if (upsertData.length > 0) {
    try {
      const supabase = getSupabase();
      
      const { error } = await supabase
        .from('shell_club_holdings')
        .upsert(upsertData, { onConflict: 'address,recorded_at' });

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ success: false, error: error.message });
      }
      
      console.log('Saved to shell_club_holdings successfully');
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ 
        success: false, 
        error: dbError instanceof Error ? dbError.message : 'Database error' 
      });
    }
  }

  return NextResponse.json({
    success: true,
    results,
    savedCount: upsertData.length,
    message: 'SHELL CLUB data refreshed',
  });
}

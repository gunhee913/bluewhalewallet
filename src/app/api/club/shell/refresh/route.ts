import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import { SHELL_CLUB_MEMBERS } from '@/constants/shell-club';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 300초
export const maxDuration = 300;

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
  // 페이지 로드 후 10초 대기 (동적 콘텐츠 로딩)
  await new Promise((r) => setTimeout(r, 10000));
  
  // 최대 15초 동안 폴링 (1초 간격)
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const result = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim()).filter(l => l);
        
        // SHELL 토큰 찾기 (토큰 목록에서, "By Token" 섹션 이후의 SHELL)
        for (let i = 0; i < lines.length; i++) {
          // 토큰 상세 정보의 SHELL (가격 정보가 바로 뒤에 오는 경우)
          if (lines[i] === 'SHELL' && i + 1 < lines.length && lines[i + 1].includes('$')) {
            // 구조: SHELL → 가격 → 가치 → 숫자(정수부). → 숫자(소수부) → Units
            // [54] SHELL
            // [55] $ 0.000453+7.59 %  (가격)
            // [56] $ 24.527           (가치)
            // [57] 54,214.            (보유량 정수부)
            // [58] 9808               (보유량 소수부)
            // [59] Units
            
            let price = 0;
            let value = 0;
            let amount = 0;
            
            // Units 위치 찾기
            let unitsIndex = -1;
            for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
              if (lines[j] === 'Units') {
                unitsIndex = j;
                break;
              }
            }
            
            if (unitsIndex === -1) continue;
            
            // Units 바로 앞 2줄을 합쳐서 보유량 추출
            // 예: "54,214." + "9808" = "54214.9808"
            const numPart1 = lines[unitsIndex - 2] || '';  // 54,214.
            const numPart2 = lines[unitsIndex - 1] || '';  // 9808
            
            // 숫자 조합
            const combinedNum = (numPart1 + numPart2).replace(/,/g, '');
            const amountMatch = combinedNum.match(/([\d.]+)/);
            if (amountMatch) {
              amount = parseFloat(amountMatch[1]);
            }
            
            // 가격과 가치 추출 (SHELL 이후 $ 패턴)
            for (let j = i + 1; j < unitsIndex; j++) {
              const line = lines[j];
              // 가격: $ 0.000453+7.59 %
              const priceMatch = line.match(/\$\s*([\d.]+)\s*[+-]/);
              if (priceMatch && price === 0) {
                price = parseFloat(priceMatch[1]);
                continue;
              }
              // 가치: $ 24.527
              const valueMatch = line.match(/^\$\s*([\d,]+\.?\d*)$/);
              if (valueMatch) {
                value = parseFloat(valueMatch[1].replace(/,/g, ''));
              }
            }
            
            if (amount > 0) {
              // 소수점 이하 버리고 정수로 반환
              const finalAmount = Math.floor(amount);
              console.log(`Found SHELL: ${finalAmount} Units, $${value}, price: $${price}`);
              return { amount: finalAmount, value, price };
            }
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
  const failedAddresses: string[] = [];

  // 각 지갑 순차 처리
  for (const address of addresses) {
    const shellData = await fetchShellForWallet(address, browserlessToken);
    results[address.toLowerCase()] = shellData;
    
    if (!shellData) {
      failedAddresses.push(address);
    }
    
    // 다음 요청 전 30초 대기 (rate limit 방지)
    if (addresses.length > 1) {
      await new Promise((r) => setTimeout(r, 30000));
    }
  }

  // 실패한 멤버 재시도 (15초 대기 후)
  if (failedAddresses.length > 0) {
    console.log(`[SHELL] Retrying ${failedAddresses.length} failed members...`);
    await new Promise((r) => setTimeout(r, 15000));
    
    for (const address of failedAddresses) {
      const shellData = await fetchShellForWallet(address, browserlessToken);
      if (shellData) {
        results[address.toLowerCase()] = shellData;
        console.log(`[SHELL] Retry success for ${address.slice(0, 8)}`);
      } else {
        console.log(`[SHELL] Retry failed for ${address.slice(0, 8)}`);
      }
      
      if (failedAddresses.length > 1) {
        await new Promise((r) => setTimeout(r, 30000));
      }
    }
  }

  // Supabase에 저장
  const koreaDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = koreaDate.toISOString().split('T')[0];
  
  const successResults = Object.entries(results).filter(([, data]) => data !== null);
  const upsertData = successResults.map(([address, data]) => ({
    address: address.toLowerCase(),
    shell_amount: data!.amount,
    shell_value: data!.value,
    shell_price: data!.price,
    recorded_at: today,
  }));

  console.log(`Saving to Supabase: ${upsertData.length}/${addresses.length} members`);

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

  const finalFailedCount = Object.values(results).filter(v => v === null).length;

  return NextResponse.json({
    success: true,
    results,
    savedCount: upsertData.length,
    failedCount: finalFailedCount,
    message: `SHELL CLUB data refreshed (${upsertData.length}/${addresses.length} success)`,
  });
}

import { NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// 소각 지갑 주소
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const PUMPSPACE_URL = `https://pumpspace.io/wallet/detail?account=${BURN_ADDRESS}`;

// 토큰 정보 (총 발행량)
const TOKEN_INFO: Record<string, number> = {
  'sBWPM': 7000,
  'sADOL': 70000,
  'CLAM': 70000000,
  'PEARL': 0,
  'SHELL': 0,
  'CORAL': 0,
  'AQUA1': 0,
};

// Supabase 클라이언트
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// 토큰 소각 데이터 추출 (새로운 로직)
async function extractTokenBurnData(page: Page): Promise<Record<string, { units: number; value: string }>> {
  // 페이지 로드 후 10초 대기
  await new Promise((r) => setTimeout(r, 10000));
  
  const result: Record<string, { units: number; value: string }> = {};
  const tokenNames = Object.keys(TOKEN_INFO);
  
  // 최대 10초 동안 폴링
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pageText = await page.evaluate(() => document.body.innerText);
      const lines = pageText.split('\n').map((l) => l.trim());
      
      console.log(`[Attempt ${attempt + 1}] Page lines count: ${lines.length}`);
      
      for (const tokenName of tokenNames) {
        // 이미 찾은 토큰은 스킵
        if (result[tokenName]) continue;
        
        // 토큰명이 있는 라인 인덱스 찾기
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // 정확히 토큰명만 있는 라인 찾기 (Held Tokens 섹션)
          if (line === tokenName) {
            console.log(`[${tokenName}] Found at line ${i}`);
            
            // 다음 10줄에서 가격과 Units 찾기
            let value = '$0';
            let units = 0;
            
            for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
              const searchLine = lines[j];
              
              // 총 가치 패턴: "$ 숫자" (가격+변화율이 아닌 것)
              // 가격+변화율: "$ 44.653+41.8 %" 또는 "$ 1,037.1+54.61 %"
              // 총 가치: "$ 22,721" 또는 "$ 1,152.3"
              if (searchLine.startsWith('$ ') && !searchLine.includes('%') && value === '$0') {
                const numStr = searchLine.replace('$ ', '').replace(/,/g, '');
                const num = parseFloat(numStr);
                if (!isNaN(num) && num > 0) {
                  value = '$' + Math.floor(num).toLocaleString();
                  console.log(`[${tokenName}] Value: ${value}`);
                }
              }
              
              // Units 패턴: "숫자." 다음 줄에 "소수점이하" 그 다음에 "Units"
              // 예: "508." -> "8353" -> "Units"
              if (searchLine === 'Units' && j >= 2) {
                // 바로 앞 두 줄에서 숫자 조합
                const decimalPart = lines[j - 1]; // 소수점 이하
                const integerPart = lines[j - 2]; // 정수부 + "."
                
                if (integerPart && integerPart.endsWith('.') && decimalPart) {
                  const fullNumber = integerPart + decimalPart;
                  const parsed = parseFloat(fullNumber.replace(/,/g, ''));
                  if (!isNaN(parsed) && parsed > 0) {
                    units = parsed;
                    console.log(`[${tokenName}] Units: ${units}`);
                  }
                }
              }
            }
            
            if (units > 0) {
              result[tokenName] = { units, value };
              console.log(`[${tokenName}] ✓ Extracted: ${units} units, ${value}`);
            }
            break;
          }
        }
      }
      
      console.log(`[Attempt ${attempt + 1}] Found ${Object.keys(result).length}/${tokenNames.length} tokens`);
      
      // 모든 토큰 찾았으면 종료
      if (Object.keys(result).length >= tokenNames.length) {
        break;
      }
    } catch (e) {
      console.error(`[Attempt ${attempt + 1}] Error:`, e);
    }
    
    await new Promise((r) => setTimeout(r, 1000));
  }
  
  return result;
}

// GET: 토큰 소각 데이터 저장
export async function GET() {
  console.log('[Token Burn Save] Starting...');
  
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  
  if (!browserlessToken) {
    return NextResponse.json({
      success: false,
      error: 'BROWSERLESS_TOKEN not configured',
    });
  }
  
  let browser = null;
  
  try {
    console.log('[Token Burn Save] Connecting to Browserless...');
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    console.log('[Token Burn Save] Connected!');
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log(`[Token Burn Save] Navigating to: ${PUMPSPACE_URL}`);
    await page.goto(PUMPSPACE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    console.log('[Token Burn Save] Page loaded');
    
    const burnData = await extractTokenBurnData(page);
    console.log('[Token Burn Save] Extracted:', burnData);
    
    await page.close();
    
    // Supabase에 저장
    const supabase = getSupabase();
    const today = new Date().toISOString().split('T')[0];
    
    const upsertData = Object.entries(TOKEN_INFO).map(([tokenName, totalSupply]) => ({
      token_name: tokenName,
      total_supply: totalSupply,
      burned_amount: burnData[tokenName]?.units || 0,
      burned_value: burnData[tokenName]?.value || '$0',
      recorded_at: today,
    }));
    
    console.log('[Token Burn Save] Saving:', upsertData);
    
    const { error: upsertError } = await supabase
      .from('token_burn')
      .upsert(upsertData, { onConflict: 'token_name,recorded_at' });
    
    if (upsertError) {
      console.error('[Token Burn Save] Supabase error:', upsertError);
      return NextResponse.json({ 
        success: false, 
        error: upsertError.message,
        extracted: burnData,
      });
    }
    
    console.log('[Token Burn Save] Success!');
    return NextResponse.json({
      success: true,
      message: `Saved ${upsertData.length} tokens for ${today}`,
      data: upsertData,
      extracted: burnData,
    });
  } catch (error: unknown) {
    console.error('[Token Burn Save] Error:', error);
    
    let errorMsg = 'Unknown error';
    if (error instanceof Error) {
      errorMsg = error.message;
    } else if (typeof error === 'object' && error !== null) {
      try {
        errorMsg = JSON.stringify(error);
      } catch {
        errorMsg = String(error);
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMsg,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('[Token Burn Save] Browser close error:', e);
      }
    }
  }
}

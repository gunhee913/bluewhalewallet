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

// 토큰 소각 데이터 추출 - 더 robust한 방식
async function extractTokenBurnData(page: Page): Promise<Record<string, { units: number; value: string }>> {
  // 페이지 로드 후 10초 대기 (JavaScript 렌더링 완료 대기)
  await new Promise((r) => setTimeout(r, 10000));
  
  const result: Record<string, { units: number; value: string }> = {};
  const tokenNames = Object.keys(TOKEN_INFO);
  
  // 최대 15초 동안 폴링
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const data = await page.evaluate((tokens: string[]) => {
        const body = document.body.innerText;
        const extracted: Record<string, { units: number; value: string }> = {};
        
        console.log('Page body length:', body.length);
        
        for (const tokenName of tokens) {
          // 토큰이 페이지에 있는지 확인
          if (!body.includes(tokenName)) {
            console.log(`Token ${tokenName} not found in page`);
            continue;
          }
          
          // 방법 1: 줄 단위로 검색
          const lines = body.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 토큰 이름이 포함된 줄 찾기
            if (line.includes(tokenName)) {
              console.log(`Found ${tokenName} at line ${i}: ${line}`);
              
              // 현재 줄과 이후 10줄에서 Units와 Value 찾기
              let foundUnits = 0;
              let foundValue = '$0';
              
              for (let j = i; j < Math.min(i + 10, lines.length); j++) {
                const searchLine = lines[j];
                
                // Units 찾기 (숫자 Units 패턴)
                const unitsMatch = searchLine.match(/([\d,]+(?:\.\d+)?)\s*Units/i);
                if (unitsMatch && foundUnits === 0) {
                  foundUnits = parseFloat(unitsMatch[1].replace(/,/g, ''));
                  console.log(`Found units for ${tokenName}: ${foundUnits}`);
                }
                
                // Value 찾기 ($숫자 패턴)
                const valueMatch = searchLine.match(/\$\s*([\d,]+(?:\.\d+)?)/);
                if (valueMatch && foundValue === '$0') {
                  const val = parseFloat(valueMatch[1].replace(/,/g, ''));
                  if (val > 0) {
                    foundValue = '$' + valueMatch[1];
                    console.log(`Found value for ${tokenName}: ${foundValue}`);
                  }
                }
              }
              
              if (foundUnits > 0) {
                extracted[tokenName] = { units: foundUnits, value: foundValue };
                break; // 이 토큰은 찾았으니 다음 토큰으로
              }
            }
          }
          
          // 방법 2: 정규식으로 전체 검색 (방법 1 실패시)
          if (!extracted[tokenName]) {
            // 토큰명 뒤에 오는 숫자 Units 패턴
            const regex = new RegExp(tokenName + '[\\s\\S]{0,300}?([\\d,]+(?:\\.\\d+)?)\\s*Units', 'i');
            const match = body.match(regex);
            
            if (match) {
              const units = parseFloat(match[1].replace(/,/g, ''));
              
              // Value 찾기
              const valueRegex = new RegExp(tokenName + '[\\s\\S]{0,300}?\\$\\s*([\\d,]+(?:\\.\\d+)?)', 'i');
              const valueMatch = body.match(valueRegex);
              const value = valueMatch ? '$' + valueMatch[1] : '$0';
              
              if (units > 0) {
                extracted[tokenName] = { units, value };
                console.log(`Regex found ${tokenName}: ${units} Units, ${value}`);
              }
            }
          }
        }
        
        return extracted;
      }, tokenNames);
      
      // 결과 병합
      for (const [token, info] of Object.entries(data)) {
        if (info.units > 0) {
          result[token] = info;
        }
      }
      
      console.log(`Attempt ${attempt + 1}: Found ${Object.keys(result).length}/${tokenNames.length} tokens`);
      
      // 모든 토큰 찾았으면 종료
      if (Object.keys(result).length === tokenNames.length) {
        break;
      }
    } catch (e) {
      console.error(`Attempt ${attempt + 1} error:`, e);
    }
    
    await new Promise((r) => setTimeout(r, 1000));
  }
  
  return result;
}

// GET: 자정에 호출되어 토큰 소각 데이터 저장
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
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}&timeout=240000`,
    });
    console.log('[Token Burn Save] Connected to Browserless');
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log(`[Token Burn Save] Navigating to: ${PUMPSPACE_URL}`);
    await page.goto(PUMPSPACE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    
    console.log('[Token Burn Save] Page loaded, extracting data...');
    const burnData = await extractTokenBurnData(page);
    console.log('[Token Burn Save] Extracted data:', JSON.stringify(burnData));
    
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
    
    console.log('[Token Burn Save] Saving to Supabase:', JSON.stringify(upsertData));
    
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
    });
  } catch (error: unknown) {
    console.error('[Token Burn Save] Error:', error);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // ErrorEvent 등 특수 객체 처리
      const errObj = error as Record<string, unknown>;
      errorMessage = errObj.message as string || errObj.error as string || JSON.stringify(error, Object.getOwnPropertyNames(error));
    } else {
      errorMessage = String(error);
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('[Token Burn Save] Browser closed');
      } catch (e) {
        console.error('[Token Burn Save] Browser close error:', e);
      }
    }
  }
}

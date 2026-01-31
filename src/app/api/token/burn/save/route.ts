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

// 토큰 소각 데이터 추출
async function extractTokenBurnData(page: Page): Promise<Record<string, { units: number; value: string }>> {
  // 페이지 로드 후 8초 대기
  await new Promise((r) => setTimeout(r, 8000));
  
  const result: Record<string, { units: number; value: string }> = {};
  
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const data = await page.evaluate((tokenNames: string[]) => {
        const body = document.body.innerText;
        const extracted: Record<string, { units: number; value: string }> = {};
        
        for (const tokenName of tokenNames) {
          // 토큰 이름 근처에서 Units와 Value 찾기
          const regex = new RegExp(
            tokenName + '[\\s\\S]{0,200}?([\\d,]+(?:\\.\\d+)?)\\s*(?:Units|units)[\\s\\S]{0,100}?\\$([\\d,]+(?:\\.\\d+)?)',
            'i'
          );
          
          const match = body.match(regex);
          if (match) {
            const units = parseFloat(match[1].replace(/,/g, ''));
            const value = '$' + match[2];
            extracted[tokenName] = { units, value };
          } else {
            // 대안: 토큰 이름 포함된 줄에서 숫자 찾기
            const lines = body.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(tokenName)) {
                // 근처 줄들에서 숫자 찾기
                for (let j = i; j < Math.min(i + 5, lines.length); j++) {
                  const unitsMatch = lines[j].match(/([\d,]+(?:\.\d+)?)\s*(?:Units|units)/i);
                  const valueMatch = lines[j].match(/\$\s*([\d,]+(?:\.\d+)?)/);
                  
                  if (unitsMatch && !extracted[tokenName]) {
                    extracted[tokenName] = {
                      units: parseFloat(unitsMatch[1].replace(/,/g, '')),
                      value: valueMatch ? '$' + valueMatch[1] : '$0'
                    };
                  }
                }
              }
            }
          }
        }
        
        return extracted;
      }, Object.keys(TOKEN_INFO));
      
      // 결과 병합
      for (const [token, info] of Object.entries(data)) {
        if (info.units > 0) {
          result[token] = info;
        }
      }
      
      // 모든 토큰 찾았으면 종료
      if (Object.keys(result).length === Object.keys(TOKEN_INFO).length) {
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
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log(`[Token Burn Save] Navigating to: ${PUMPSPACE_URL}`);
    await page.goto(PUMPSPACE_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
    
    const burnData = await extractTokenBurnData(page);
    console.log('[Token Burn Save] Extracted data:', burnData);
    
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
    
    console.log('[Token Burn Save] Saving to Supabase:', upsertData);
    
    const { error: upsertError } = await supabase
      .from('token_burn')
      .upsert(upsertData, { onConflict: 'token_name,recorded_at' });
    
    if (upsertError) {
      console.error('[Token Burn Save] Supabase error:', upsertError);
      return NextResponse.json({ success: false, error: upsertError.message });
    }
    
    console.log('[Token Burn Save] Success!');
    return NextResponse.json({
      success: true,
      message: `Saved ${upsertData.length} tokens for ${today}`,
      data: upsertData,
    });
  } catch (error) {
    console.error('[Token Burn Save] Error:', error);
    const errorMessage = error instanceof Error 
      ? `${error.name}: ${error.message}` 
      : JSON.stringify(error);
    return NextResponse.json({
      success: false,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
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

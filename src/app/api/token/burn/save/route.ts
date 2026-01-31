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
  // 페이지 로드 후 12초 대기
  await new Promise((r) => setTimeout(r, 12000));
  
  const result: Record<string, { units: number; value: string }> = {};
  const tokenNames = Object.keys(TOKEN_INFO);
  
  // 최대 15초 동안 폴링
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const data = await page.evaluate((tokens: string[]) => {
        const body = document.body.innerText;
        const extracted: Record<string, { units: number; value: string }> = {};
        
        // 디버깅: 토큰이 페이지에 있는지 확인
        console.log('Tokens to find:', tokens);
        console.log('Body includes sBWPM:', body.includes('sBWPM'));
        console.log('Body includes sADOL:', body.includes('sADOL'));
        console.log('Body includes CLAM:', body.includes('CLAM'));
        
        for (const tokenName of tokens) {
          if (!body.includes(tokenName)) {
            console.log(`Token ${tokenName} NOT found in page`);
            continue;
          }
          console.log(`Token ${tokenName} found in page`);
          
          // 페이지에서 토큰 행 찾기
          const lines = body.split('\n');
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.includes(tokenName) && !line.includes('Show')) {
              console.log(`Found line for ${tokenName}: "${line}"`);
              
              // 이 줄과 주변 줄에서 Units와 Value 찾기
              let units = 0;
              let value = '$0';
              
              // 현재 줄부터 10줄 검색
              for (let j = i; j < Math.min(i + 10, lines.length); j++) {
                const searchLine = lines[j];
                
                // Units 패턴: "숫자 Units" 또는 "숫자Units"
                const unitsMatch = searchLine.match(/([\d,]+(?:\.\d+)?)\s*Units/i);
                if (unitsMatch && units === 0) {
                  units = parseFloat(unitsMatch[1].replace(/,/g, ''));
                  console.log(`Found units for ${tokenName}: ${units}`);
                }
                
                // Value 패턴: "$ 숫자" (큰 금액, 토큰 가치)
                const valueMatches = searchLine.match(/\$\s*([\d,]+(?:\.\d+)?)/g);
                if (valueMatches && value === '$0') {
                  for (const match of valueMatches) {
                    const numStr = match.replace(/[$\s,]/g, '');
                    const num = parseFloat(numStr);
                    // $10 이상인 값 (작은 금액도 허용)
                    if (num >= 10) {
                      value = '$' + num.toLocaleString();
                      console.log(`Found value for ${tokenName}: ${value}`);
                      break;
                    }
                  }
                }
              }
              
              if (units > 0) {
                extracted[tokenName] = { units, value };
                break;
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
      
      console.log(`Attempt ${attempt + 1}: Found ${Object.keys(result).length}/${tokenNames.length} tokens`, result);
      
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
  
  // 토큰 앞 10자리만 확인용
  console.log('[Token Burn Save] Token prefix:', browserlessToken.slice(0, 10));
  
  let browser = null;
  
  try {
    console.log('[Token Burn Save] Step 1: Connecting to Browserless...');
    try {
      browser = await puppeteer.connect({
        browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
      });
    } catch (connectErr: unknown) {
      console.error('[Token Burn Save] Connect error:', connectErr);
      
      let details = 'Unknown';
      if (connectErr instanceof Error) {
        details = connectErr.message;
      } else if (connectErr && typeof connectErr === 'object') {
        const err = connectErr as Record<string, unknown>;
        // ErrorEvent에서 message 추출
        details = (err.message as string) || (err.error as string) || 'ErrorEvent';
        if (err.type) details += ` (type: ${err.type})`;
      }
      
      return NextResponse.json({
        success: false,
        error: 'Browserless connect failed',
        details,
      });
    }
    console.log('[Token Burn Save] Step 2: Connected!');
    
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
    
    // 디버깅: 페이지 텍스트 일부 가져오기
    const debugPage = await browser.newPage();
    await debugPage.goto(PUMPSPACE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((r) => setTimeout(r, 8000));
    const pageText = await debugPage.evaluate(() => document.body.innerText.slice(0, 2000));
    await debugPage.close();
    
    console.log('[Token Burn Save] Success!');
    return NextResponse.json({
      success: true,
      message: `Saved ${upsertData.length} tokens for ${today}`,
      data: upsertData,
      extracted: burnData,
      debug_page_text: pageText,
    });
  } catch (error: unknown) {
    console.error('[Token Burn Save] Error type:', typeof error);
    console.error('[Token Burn Save] Error:', error);
    
    let errorMsg = 'Unknown error';
    if (error instanceof Error) {
      errorMsg = `${error.name}: ${error.message}`;
    } else if (error && typeof error === 'object') {
      try {
        errorMsg = JSON.stringify(error);
      } catch {
        errorMsg = String(error);
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMsg,
      errorType: typeof error,
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

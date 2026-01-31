import { NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// 소각 지갑 주소
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const PUMPSPACE_URL = `https://pumpspace.io/wallet/detail?account=${BURN_ADDRESS}`;

// 추적할 토큰 목록
const TOKEN_NAMES = ['sBWPM', 'sADOL', 'CLAM', 'PEARL', 'SHELL', 'CORAL', 'AQUA1'];

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
async function extractTokenBurnData(page: Page): Promise<Record<string, { units: number; value: string; tokenPrice: number }>> {
  // 페이지 로드 후 8초 대기
  await new Promise((r) => setTimeout(r, 8000));
  
  const result: Record<string, { units: number; value: string; tokenPrice: number }> = {};
  const tokenNames = TOKEN_NAMES;
  
  // 최대 10초 동안 폴링
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const pageText = await page.evaluate(() => document.body.innerText);
      const lines = pageText.split('\n').map((l) => l.trim());
      
      console.log(`[Attempt ${attempt + 1}] Page lines count: ${lines.length}`);
      
      // "Held Tokens" 섹션 시작점 찾기
      let heldTokensStart = 0;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i] === 'Held Tokens') {
          heldTokensStart = i;
          console.log(`[Held Tokens section starts at line ${i}]`);
          break;
        }
      }
      
      for (const tokenName of tokenNames) {
        // 이미 찾은 토큰은 스킵
        if (result[tokenName]) continue;
        
        // "Held Tokens" 이후에서 토큰명 찾기
        for (let i = heldTokensStart; i < lines.length; i++) {
          const line = lines[i];
          
          // 정확히 토큰명만 있는 라인 찾기
          if (line === tokenName) {
            console.log(`[${tokenName}] Found at line ${i}`);
            
            let value = '$0';
            let units = 0;
            let tokenPrice = 0;
            
            for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
              const searchLine = lines[j];
              
              // 다른 토큰을 만나면 중단
              if (tokenNames.includes(searchLine) && searchLine !== tokenName) {
                break;
              }
              
              // 토큰 가격 패턴 ($ 44.653+41.8 % 형태)
              if (searchLine.startsWith('$ ') && searchLine.includes('%') && tokenPrice === 0) {
                const priceMatch = searchLine.match(/\$ ([\d,.]+)/);
                if (priceMatch) {
                  const price = parseFloat(priceMatch[1].replace(/,/g, ''));
                  if (!isNaN(price) && price > 0) {
                    tokenPrice = price;
                    console.log(`[${tokenName}] Token Price: $${tokenPrice}`);
                  }
                }
              }
              
              // 총 가치 패턴 ($ 22,721 형태, % 없음)
              if (searchLine.startsWith('$ ') && !searchLine.includes('%') && value === '$0') {
                const numStr = searchLine.replace('$ ', '').replace(/,/g, '');
                const num = parseFloat(numStr);
                if (!isNaN(num) && num > 0) {
                  value = '$' + Math.floor(num).toLocaleString();
                  console.log(`[${tokenName}] Value: ${value}`);
                }
              }
              
              // Units 패턴
              if (searchLine === 'Units' && j >= 2) {
                const decimalPart = lines[j - 1];
                const integerPart = lines[j - 2];
                
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
              result[tokenName] = { units, value, tokenPrice };
              console.log(`[${tokenName}] ✓ Extracted: ${units} units, ${value}, price: $${tokenPrice}`);
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

// 단일 크롤링 시도 (재시도 로직 포함)
async function fetchTokenData(browserlessToken: string, retryCount: number = 0): Promise<Record<string, { units: number; value: string; tokenPrice: number }> | null> {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[Token Burn] Connecting... (attempt ${retryCount + 1})`);
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log(`[Token Burn] Navigating to: ${PUMPSPACE_URL}`);
    await page.goto(PUMPSPACE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    console.log('[Token Burn] Page loaded');
    
    const burnData = await extractTokenBurnData(page);
    console.log('[Token Burn] Extracted:', burnData);
    
    return burnData;
  } catch (error) {
    console.error(`[Token Burn] Error (attempt ${retryCount + 1}):`, error);
    
    // 재시도 (최대 1회)
    if (retryCount < 1) {
      console.log('[Token Burn] Retrying...');
      await new Promise((r) => setTimeout(r, 5000));
      return fetchTokenData(browserlessToken, retryCount + 1);
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
  
  const burnData = await fetchTokenData(browserlessToken);
  
  if (!burnData || Object.keys(burnData).length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Failed to extract token data',
    });
  }
  
  // Supabase에 저장 (성공한 토큰만)
  const supabase = getSupabase();
  // 한국 시간 기준 날짜 (UTC+9)
  const koreaDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = koreaDate.toISOString().split('T')[0];
  
  // token_info 테이블에서 총 발행량 가져오기
  const { data: tokenInfoData } = await supabase
    .from('token_info')
    .select('token_name, total_supply');
  
  const tokenSupplyMap: Record<string, number> = {};
  if (tokenInfoData) {
    tokenInfoData.forEach((t: { token_name: string; total_supply: number }) => {
      tokenSupplyMap[t.token_name] = t.total_supply;
    });
  }
  
  // 성공한 토큰만 저장 (실패한 토큰은 기존 값 유지)
  const upsertData = TOKEN_NAMES
    .filter((tokenName) => burnData[tokenName] && burnData[tokenName].units > 0)
    .map((tokenName) => ({
      token_name: tokenName,
      total_supply: tokenSupplyMap[tokenName] || 0,
      burned_amount: burnData[tokenName].units,
      burned_value: burnData[tokenName].value,
      token_price: burnData[tokenName].tokenPrice || 0,
      recorded_at: today,
    }));
  
  console.log('[Token Burn Save] Saving:', upsertData);
  
  if (upsertData.length > 0) {
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
  }
  
  console.log('[Token Burn Save] Success!');
  return NextResponse.json({
    success: true,
    message: `Saved ${upsertData.length} tokens for ${today}`,
    data: upsertData,
    extracted: burnData,
  });
}

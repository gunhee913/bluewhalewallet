import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// KaiaScan 토큰 페이지 URL
const KAIASCAN_URL = 'https://kaiascan.io/token/';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// 토큰 컨트랙트 주소 매핑
const TOKEN_CONTRACTS: Record<string, string> = {
  'sBWPM': '0xf4546e1d3ad590a3c6d178d671b3bc0e8a81e27d',
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// 총 공급량 추출
async function extractTotalSupply(page: Page): Promise<number | null> {
  // 페이지 로드 후 5초 대기
  await new Promise((r) => setTimeout(r, 5000));
  
  // 최대 10초 동안 폴링
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result = await page.evaluate(() => {
        const body = document.body.innerText;
        
        // "총 공급량" 또는 "Total Supply" 찾기
        const patterns = [
          /총\s*공급량[:\s]*([\d,]+)/i,
          /Total\s*Supply[:\s]*([\d,]+)/i,
        ];
        
        for (const pattern of patterns) {
          const match = body.match(pattern);
          if (match && match[1]) {
            return parseInt(match[1].replace(/,/g, ''), 10);
          }
        }
        
        // 페이지에서 숫자 패턴으로 찾기
        // sBWPM 앞에 있는 숫자 찾기
        const sbwpmMatch = body.match(/([\d,]+)\s*sBWPM/);
        if (sbwpmMatch && sbwpmMatch[1]) {
          return parseInt(sbwpmMatch[1].replace(/,/g, ''), 10);
        }
        
        return null;
      });

      if (result && result > 0) {
        console.log(`Found total supply: ${result} (attempt ${attempt + 1})`);
        return result;
      }
    } catch (e) {
      console.error(`Attempt ${attempt + 1} error:`, e);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return null;
}

// 단일 토큰 크롤링
async function fetchTokenSupply(
  tokenName: string,
  contractAddress: string,
  browserlessToken: string,
  retryCount: number = 0
): Promise<number | null> {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[${tokenName}] Connecting... (attempt ${retryCount + 1})`);
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    const url = `${KAIASCAN_URL}${contractAddress}`;
    console.log(`[${tokenName}] Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 45000 
    });

    const totalSupply = await extractTotalSupply(page);
    console.log(`[${tokenName}] Result: ${totalSupply}`);
    
    return totalSupply;

  } catch (err) {
    console.error(`[${tokenName}] Error:`, err);
    
    // 재시도 (최대 2회)
    if (retryCount < 2) {
      console.log(`[${tokenName}] Retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
      return fetchTokenSupply(tokenName, contractAddress, browserlessToken, retryCount + 1);
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

// GET: 토큰 총 공급량 조회 (캐시된 데이터)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';
  const tokenName = searchParams.get('token');
  
  try {
    const supabase = getSupabase();
    
    // refresh=true면 크롤링 실행
    if (refresh) {
      const browserlessToken = process.env.BROWSERLESS_TOKEN;
      if (!browserlessToken) {
        return NextResponse.json({ success: false, error: 'BROWSERLESS_TOKEN not configured' });
      }
      
      const tokensToFetch = tokenName 
        ? { [tokenName]: TOKEN_CONTRACTS[tokenName] }
        : TOKEN_CONTRACTS;
      
      const results: Record<string, number | null> = {};
      
      for (const [name, address] of Object.entries(tokensToFetch)) {
        if (!address) continue;
        const supply = await fetchTokenSupply(name, address, browserlessToken);
        results[name] = supply;
        
        // 다음 요청 전 대기
        if (Object.keys(tokensToFetch).length > 1) {
          await new Promise((r) => setTimeout(r, 10000));
        }
      }
      
      // Supabase에 저장
      const now = new Date().toISOString();
      const upsertData = Object.entries(results)
        .filter(([, supply]) => supply !== null)
        .map(([name, supply]) => ({
          token_name: name,
          circulating_supply: supply,
          updated_at: now,
        }));
      
      if (upsertData.length > 0) {
        const { error } = await supabase
          .from('token_supply')
          .upsert(upsertData, { onConflict: 'token_name' });
        
        if (error) {
          console.error('Supabase error:', error);
        }
      }
      
      return NextResponse.json({ success: true, results });
    }
    
    // 캐시된 데이터 조회
    const { data, error } = await supabase
      .from('token_supply')
      .select('*');
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message, tokens: [] });
    }
    
    return NextResponse.json({
      success: true,
      tokens: data || [],
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tokens: [],
    });
  }
}

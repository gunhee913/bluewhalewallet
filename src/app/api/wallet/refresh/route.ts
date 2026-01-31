import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// 모든 지갑 주소
const ALL_ADDRESSES = [
  '0x3654378aa2deb0860c2e5c7906471c8704c44c6f',
  '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7',
  '0xD57423c54F188220862391A069a2942c725ee37B',
  '0xfd48a5FFE5127896E93BAA8074CE98c5a999Ea97',
  '0x000000000000000000000000000000000000dEaD',
  '0x525e7f0a5d3fd6169d6ec35288104d52bf3bb95f',
];

// Supabase 클라이언트 (lazy initialization)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// Total Assets 추출 - 더 단순하고 확실한 방식
async function extractTotalAssets(page: Page): Promise<string> {
  // 페이지 로드 후 10초 대기 (JavaScript 렌더링 완료 대기)
  await new Promise((r) => setTimeout(r, 10000));
  
  // 최대 15초 동안 폴링
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const result = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim());
        
        // 1. "Total Assets" 줄 찾고 다음 줄에서 금액 추출
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].toLowerCase();
          if (line === 'total assets' || line.includes('total assets')) {
            // 다음 5줄에서 "$ 숫자" 패턴 찾기
            for (let j = i; j < Math.min(i + 5, lines.length); j++) {
              const searchLine = lines[j];
              // "$ 51,554" 또는 "$51,554" 형식
              const match = searchLine.match(/\$\s*([\d,]+(?:\.\d+)?)/);
              if (match && match[1]) {
                const val = parseFloat(match[1].replace(/,/g, ''));
                // $10 이상이면 유효 (v3 수수료 펀드는 $796 정도)
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

      if (result) {
        console.log(`Found: ${result} (attempt ${attempt + 1})`);
        return result;
      }
    } catch (e) {
      console.error(`Attempt ${attempt + 1} error:`, e);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return '$0';
}

// GET: 모든 지갑 새로고침 (Cron에서 호출)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const addressesParam = searchParams.get('addresses');
  const addresses = addressesParam 
    ? addressesParam.split(',').map(a => a.trim()) 
    : ALL_ADDRESSES;
  
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

  let browser = null;
  const results: Record<string, string | null> = {};

  try {
    console.log('Connecting to Browserless...');
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    console.log('Connected to Browserless');

    // 각 주소마다 새 페이지 생성 (detached frame 에러 방지)
    for (const address of addresses) {
      let page = null;
      try {
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        const url = `${PUMPSPACE_URL}${address}`;
        console.log(`Navigating to: ${url}`);
        
        await page.goto(url, { 
          waitUntil: 'networkidle2', 
          timeout: 45000 
        });

        const totalAssets = await extractTotalAssets(page);
        results[address.toLowerCase()] = totalAssets;
        console.log(`Result for ${address}: ${totalAssets}`);

      } catch (err) {
        console.error(`Error fetching ${address}:`, err);
        results[address.toLowerCase()] = null;
      } finally {
        // 각 페이지 처리 후 반드시 닫기
        if (page) {
          try {
            await page.close();
          } catch (e) {
            console.error('Page close error:', e);
          }
        }
      }
      
      // 다음 요청 전 1초 대기 (rate limit 방지)
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Supabase에 저장
    const now = new Date().toISOString();
    const upsertData = Object.entries(results).map(([address, total_assets]) => ({
      address: address.toLowerCase(),
      total_assets,
      updated_at: now,
    }));

    console.log('Saving to Supabase:', upsertData);

    const supabase = getSupabase();
    const { error: upsertError } = await supabase
      .from('wallet_assets')
      .upsert(upsertData, { onConflict: 'address' });

    if (upsertError) {
      console.error('Supabase upsert error:', upsertError);
    } else {
      console.log('Saved to Supabase successfully');
    }

    return NextResponse.json({
      success: true,
      results,
      message: 'Data refreshed and saved',
    });
  } catch (error: unknown) {
    console.error('Puppeteer Error:', error);
    
    // ErrorEvent 또는 Error 객체에서 메시지 추출
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String((error as { message: unknown }).message);
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
    });
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed');
      } catch (e) {
        console.error('Browser close error:', e);
      }
    }
  }
}

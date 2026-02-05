import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Page } from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';

// KaiaScan 토큰 페이지 URL
const KAIASCAN_URL = 'https://kaiascan.io/token/';
const KAIASCAN_HOLDER_URL = 'https://kaiascan.io/token/';

// PumpSpace 지갑 페이지 URL
const PUMPSPACE_URL = 'https://pumpspace.io/wallet/detail?account=';

// Vercel Pro 최대 300초
export const maxDuration = 300;

// 토큰 컨트랙트 주소 매핑
const TOKEN_CONTRACTS: Record<string, string> = {
  'sBWPM': '0xf4546e1d3ad590a3c6d178d671b3bc0e8a81e27d',
};

// 아발란체 브릿지 지갑 주소 (sBWPM)
const AVALANCHE_BRIDGE_WALLET = '0x316091d3bd7bf9a77640d9807e3d6b5a30cbf6bb';

// 바이백 지갑 주소 (아발란체)
const BUYBACK_GOFUN = '0x3654378AA2DEb0860c2e5C7906471C8704c44c6F'; // 고펀
const BUYBACK_DOLFUN = '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7'; // 돌펀

// Snowtrace (아발란체) - sBWPM 토큰 홀더 페이지
const SNOWTRACE_URL = 'https://snowtrace.io/token/0x6c960648d5F16f9e12895C28655cc6Dd73B660f7/balances?type=erc20&chainid=43114';

// LP 풀 이름 (유동성)
const LP_POOLS = [
  'AquaLP CLAM-sBWPM',
  'AquaLP sBWPM-SHELL',
  'AquaLP PEARL-sBWPM',
  'AquaLP bUSDT-sBWPM',
];

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// PumpSpace에서 sBWPM 토큰 보유량 추출
async function extractSbwpmAmount(page: Page): Promise<number | null> {
  // 페이지 로드 후 10초 대기 (동적 콘텐츠 로딩)
  await new Promise((r) => setTimeout(r, 10000));
  
  // 최대 15초 동안 폴링 (1초 간격)
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      const result = await page.evaluate(() => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim()).filter(l => l);
        
        // sBWPM 토큰 찾기
        for (let i = 0; i < lines.length; i++) {
          if (lines[i] === 'sBWPM' && i + 1 < lines.length && lines[i + 1].includes('$')) {
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
            const numPart1 = lines[unitsIndex - 2] || '';
            const numPart2 = lines[unitsIndex - 1] || '';
            
            const combinedNum = (numPart1 + numPart2).replace(/,/g, '');
            const amountMatch = combinedNum.match(/([\d.]+)/);
            if (amountMatch) {
              const amount = parseFloat(amountMatch[1]);
              if (amount > 0) {
                console.log(`Found sBWPM: ${amount} Units`);
                return amount;
              }
            }
          }
        }
        
        return null;
      });

      if (result && result > 0) {
        console.log(`Found sBWPM: ${result} (attempt ${attempt + 1})`);
        return result;
      }
    } catch (e) {
      console.error(`Attempt ${attempt + 1} error:`, e);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return null;
}

// PumpSpace에서 바이백 지갑의 sBWPM 보유량 크롤링
async function fetchBuybackSbwpm(
  walletAddress: string,
  browserlessToken: string,
  retryCount: number = 0
): Promise<number | null> {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[Buyback ${walletAddress.slice(0, 8)}] Connecting... (attempt ${retryCount + 1})`);
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    const url = `${PUMPSPACE_URL}${walletAddress}`;
    console.log(`[Buyback] Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 45000 
    });

    const amount = await extractSbwpmAmount(page);
    console.log(`[Buyback ${walletAddress.slice(0, 8)}] Result: ${amount}`);
    
    return amount;

  } catch (err) {
    console.error(`[Buyback] Error:`, err);
    
    if (retryCount < 2) {
      console.log(`[Buyback] Retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
      return fetchBuybackSbwpm(walletAddress, browserlessToken, retryCount + 1);
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

// 특정 지갑의 토큰 잔액 추출
async function extractWalletBalance(page: Page, walletAddress: string): Promise<number | null> {
  // 페이지 로드 후 5초 대기
  await new Promise((r) => setTimeout(r, 5000));
  
  // 최대 10초 동안 폴링
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const result = await page.evaluate((targetWallet) => {
        const body = document.body.innerText;
        const lines = body.split('\n').map(l => l.trim()).filter(l => l);
        
        // 지갑 주소 찾기 (대소문자 구분 없이)
        const walletLower = targetWallet.toLowerCase();
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(walletLower) || 
              lines[i].toLowerCase().includes(walletLower.slice(0, 10))) {
            // 주소 근처에서 숫자 찾기 (잔액)
            for (let j = Math.max(0, i - 3); j < Math.min(lines.length, i + 5); j++) {
              // 숫자,소수점 패턴 찾기 (예: 1,576.895477)
              const match = lines[j].match(/([\d,]+\.?\d*)\s*sBWPM/i);
              if (match && match[1]) {
                return parseFloat(match[1].replace(/,/g, ''));
              }
              // 숫자만 있는 경우
              const numMatch = lines[j].match(/^([\d,]+\.?\d*)$/);
              if (numMatch && numMatch[1] && parseFloat(numMatch[1].replace(/,/g, '')) > 100) {
                return parseFloat(numMatch[1].replace(/,/g, ''));
              }
            }
          }
        }
        
        return null;
      }, walletAddress);

      if (result && result > 0) {
        console.log(`Found wallet balance: ${result} (attempt ${attempt + 1})`);
        return result;
      }
    } catch (e) {
      console.error(`Attempt ${attempt + 1} error:`, e);
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return null;
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

// 아발란체 브릿지 지갑 잔액 크롤링
async function fetchAvalancheBalance(
  contractAddress: string,
  browserlessToken: string,
  retryCount: number = 0
): Promise<number | null> {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[Avalanche] Connecting... (attempt ${retryCount + 1})`);
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // 토큰 홀더 페이지로 이동
    const url = `${KAIASCAN_HOLDER_URL}${contractAddress}?tabId=tokenHolder&page=1`;
    console.log(`[Avalanche] Navigating to: ${url}`);
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 45000 
    });

    const balance = await extractWalletBalance(page, AVALANCHE_BRIDGE_WALLET);
    console.log(`[Avalanche] Result: ${balance}`);
    
    return balance;

  } catch (err) {
    console.error(`[Avalanche] Error:`, err);
    
    if (retryCount < 2) {
      console.log(`[Avalanche] Retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
      return fetchAvalancheBalance(contractAddress, browserlessToken, retryCount + 1);
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

// Snowtrace에서 LP 풀 잔액 추출 - 단순화
async function extractLpBalances(page: Page): Promise<Record<string, number>> {
  // 페이지 로드 후 10초 대기
  await new Promise((r) => setTimeout(r, 10000));
  
  try {
    const lpData = await page.evaluate((lpNames) => {
      const found: Record<string, number> = {};
      const body = document.body.innerText;
      
      for (const lpName of lpNames) {
        // LP 이름 위치 찾기
        const idx = body.indexOf(lpName);
        if (idx === -1) continue;
        
        // LP 이름 뒤 100자 내에서 첫 번째 소수점 숫자 찾기
        const afterText = body.substring(idx + lpName.length, idx + lpName.length + 100);
        
        // 소수점 포함 숫자 패턴 (예: 136.371, 1,036.386)
        const match = afterText.match(/([\d,]+\.\d+)/);
        if (match) {
          const value = parseFloat(match[1].replace(/,/g, ''));
          if (value > 0) {
            found[lpName] = value;
          }
        }
      }
      
      return found;
    }, LP_POOLS);

    console.log('LP balances found:', lpData);
    return lpData;
  } catch (e) {
    console.error('LP extraction error:', e);
    return {};
  }
}

// Snowtrace에서 LP 유동성 크롤링
async function fetchLiquidityBalances(
  browserlessToken: string,
  retryCount: number = 0
): Promise<Record<string, number>> {
  let browser = null;
  let page = null;
  
  try {
    console.log(`[Liquidity] Connecting... (attempt ${retryCount + 1})`);
    browser = await puppeteer.connect({
      browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
    });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    console.log(`[Liquidity] Navigating to: ${SNOWTRACE_URL}`);
    
    await page.goto(SNOWTRACE_URL, { 
      waitUntil: 'networkidle2',
      timeout: 60000 
    });
    
    // 디버그: 페이지 내용 일부 출력
    const pageContent = await page.evaluate(() => document.body.innerText.substring(0, 3000));
    console.log(`[Liquidity] Page content preview:`, pageContent);

    const balances = await extractLpBalances(page);
    console.log(`[Liquidity] Result:`, balances);
    
    return balances;

  } catch (err) {
    console.error(`[Liquidity] Error:`, err);
    
    if (retryCount < 2) {
      console.log(`[Liquidity] Retrying...`);
      await new Promise((r) => setTimeout(r, 3000));
      return fetchLiquidityBalances(browserlessToken, retryCount + 1);
    }
    
    return {};
  } finally {
    if (page) {
      try { await page.close(); } catch (e) { /* ignore */ }
    }
    if (browser) {
      try { await browser.close(); } catch (e) { /* ignore */ }
    }
  }
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
  const crawlType = searchParams.get('type'); // 'liquidity' for LP only
  
  try {
    const supabase = getSupabase();
    
    // type=liquidity면 유동성만 크롤링
    if (crawlType === 'liquidity') {
      const browserlessToken = process.env.BROWSERLESS_TOKEN;
      if (!browserlessToken) {
        return NextResponse.json({ success: false, error: 'BROWSERLESS_TOKEN not configured' });
      }
      
      console.log('[Liquidity Only] Starting...');
      
      // 디버그: 페이지 내용도 반환
      let browser = null;
      let page = null;
      let pagePreview = '';
      
      try {
        browser = await puppeteer.connect({
          browserWSEndpoint: `wss://chrome.browserless.io?token=${browserlessToken}`,
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        
        await page.goto(SNOWTRACE_URL, { 
          waitUntil: 'networkidle2',
          timeout: 60000 
        });
        
        // 15초 대기
        await new Promise((r) => setTimeout(r, 15000));
        
        // 페이지 내용 일부 추출
        pagePreview = await page.evaluate(() => {
          return document.body.innerText.substring(0, 5000);
        });
        
        console.log('[Liquidity] Page preview:', pagePreview);
        
      } catch (e) {
        console.error('[Liquidity] Error:', e);
      } finally {
        if (page) try { await page.close(); } catch (e) { /* ignore */ }
        if (browser) try { await browser.close(); } catch (e) { /* ignore */ }
      }
      
      const liquidityBalances = await fetchLiquidityBalances(browserlessToken);
      console.log('[Liquidity Only] Result:', liquidityBalances);
      
      // LP 잔액 추출
      const lpClamSbwpm = liquidityBalances['AquaLP CLAM-sBWPM'] || null;
      const lpSbwpmShell = liquidityBalances['AquaLP sBWPM-SHELL'] || null;
      const lpPearlSbwpm = liquidityBalances['AquaLP PEARL-sBWPM'] || null;
      const lpBusdtSbwpm = liquidityBalances['AquaLP bUSDT-sBWPM'] || null;
      const liquidityTotal = Object.values(liquidityBalances).reduce((sum, v) => sum + (v || 0), 0) || null;
      
      // Supabase 업데이트 (유동성만)
      if (liquidityTotal && liquidityTotal > 0) {
        const { error } = await supabase
          .from('token_supply')
          .update({
            lp_clam_sbwpm: lpClamSbwpm,
            lp_sbwpm_shell: lpSbwpmShell,
            lp_pearl_sbwpm: lpPearlSbwpm,
            lp_busdt_sbwpm: lpBusdtSbwpm,
            liquidity_total: liquidityTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('token_name', 'sBWPM');
        
        if (error) {
          console.error('Supabase update error:', error);
        }
      }
      
      return NextResponse.json({
        success: true,
        type: 'liquidity',
        liquidityBalances,
        liquidityTotal,
        debug_pagePreview: pagePreview.substring(0, 2000), // 첫 2000자
      });
    }
    
    // refresh=true면 크롤링 실행 (유동성 제외)
    if (refresh) {
      const browserlessToken = process.env.BROWSERLESS_TOKEN;
      if (!browserlessToken) {
        return NextResponse.json({ success: false, error: 'BROWSERLESS_TOKEN not configured' });
      }
      
      const tokensToFetch = tokenName 
        ? { [tokenName]: TOKEN_CONTRACTS[tokenName] }
        : TOKEN_CONTRACTS;
      
      const results: Record<string, number | null> = {};
      let avalancheBalance: number | null = null;
      let buybackGofun: number | null = null;
      let buybackDolfun: number | null = null;
      
      for (const [name, address] of Object.entries(tokensToFetch)) {
        if (!address) continue;
        const supply = await fetchTokenSupply(name, address, browserlessToken);
        results[name] = supply;
        
        // sBWPM인 경우 아발란체 브릿지 잔액도 크롤링
        if (name === 'sBWPM') {
          await new Promise((r) => setTimeout(r, 10000)); // 대기
          avalancheBalance = await fetchAvalancheBalance(address, browserlessToken);
          
          // 바이백(고펀) 크롤링
          await new Promise((r) => setTimeout(r, 10000));
          buybackGofun = await fetchBuybackSbwpm(BUYBACK_GOFUN, browserlessToken);
          console.log(`Buyback Gofun: ${buybackGofun}`);
          
          // 바이백(돌펀) 크롤링
          await new Promise((r) => setTimeout(r, 10000));
          buybackDolfun = await fetchBuybackSbwpm(BUYBACK_DOLFUN, browserlessToken);
          console.log(`Buyback Dolfun: ${buybackDolfun}`);
        }
        
        // 다음 요청 전 대기
        if (Object.keys(tokensToFetch).length > 1) {
          await new Promise((r) => setTimeout(r, 10000));
        }
      }
      
      // Supabase에 저장
      const now = new Date().toISOString();
      const totalBuyback = (buybackGofun || 0) + (buybackDolfun || 0);
      
      const upsertData = Object.entries(results)
        .filter(([, supply]) => supply !== null)
        .map(([name, supply]) => ({
          token_name: name,
          circulating_supply: supply,
          avalanche_balance: name === 'sBWPM' ? avalancheBalance : null,
          buyback_gofun: name === 'sBWPM' ? buybackGofun : null,
          buyback_dolfun: name === 'sBWPM' ? buybackDolfun : null,
          buyback_amount: name === 'sBWPM' && totalBuyback > 0 ? totalBuyback : null,
          updated_at: now,
        }));
      
      if (upsertData.length > 0) {
        const { error } = await supabase
          .from('token_supply')
          .upsert(upsertData, { onConflict: 'token_name' });
        
        if (error) {
          console.error('Supabase upsert error:', error);
        }
        
        // 히스토리 저장 (sBWPM인 경우)
        if (results['sBWPM']) {
          const koreaDate = new Date(Date.now() + 9 * 60 * 60 * 1000);
          const today = koreaDate.toISOString().split('T')[0];
          
          const sbwpmTotal = results['sBWPM'];
          const avaxBalance = avalancheBalance || 0;
          const kaiaBalance = sbwpmTotal - avaxBalance;
          
          // 소각량 가져오기
          const { data: burnData } = await supabase
            .from('token_burn')
            .select('burned_amount')
            .eq('token_name', 'sBWPM')
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();
          
          const burnedAmount = burnData?.burned_amount || 0;
          const bwpmNft = 7000 - sbwpmTotal;
          
          const historyData = {
            recorded_at: today,
            bwpm_nft: bwpmNft,
            sbwpm_kaia: kaiaBalance - burnedAmount,
            sbwpm_avalanche: avaxBalance,
            burned_amount: burnedAmount,
            buyback_gofun: buybackGofun || 0,
            buyback_dolfun: buybackDolfun || 0,
            buyback_amount: totalBuyback || 0,
          };
          
          const { error: historyError } = await supabase
            .from('token_supply_history')
            .upsert(historyData, { onConflict: 'recorded_at' });
          
          if (historyError) {
            console.error('History save error:', historyError);
          } else {
            console.log('History saved:', historyData);
          }
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        results, 
        avalancheBalance, 
        buybackGofun, 
        buybackDolfun, 
        buybackAmount: totalBuyback
      });
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

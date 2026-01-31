import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// GET: 최신 토큰 소각 데이터 조회
export async function GET() {
  try {
    const supabase = getSupabase();
    
    // 각 토큰별 최신 데이터 가져오기
    const { data, error } = await supabase
      .from('token_burn')
      .select('*')
      .order('recorded_at', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message, tokens: [] });
    }
    
    // token_info 테이블에서 총 발행량 가져오기
    const { data: tokenInfoData } = await supabase
      .from('token_info')
      .select('token_name, total_supply');
    
    const supplyMap: Record<string, number> = {};
    if (tokenInfoData) {
      tokenInfoData.forEach((t: { token_name: string; total_supply: number }) => {
        supplyMap[t.token_name] = t.total_supply;
      });
    }
    
    // 토큰별 최신 데이터만 추출 + token_info의 total_supply 사용
    const latestByToken: Record<string, typeof data[0]> = {};
    for (const item of data || []) {
      if (!latestByToken[item.token_name]) {
        latestByToken[item.token_name] = {
          ...item,
          total_supply: supplyMap[item.token_name] ?? item.total_supply,
        };
      }
    }
    
    return NextResponse.json({
      success: true,
      tokens: Object.values(latestByToken),
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

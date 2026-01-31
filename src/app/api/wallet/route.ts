import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 (lazy initialization)
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// GET: Supabase에서 캐시된 데이터 읽기 (즉시 반환)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const addressesParam = searchParams.get('addresses');

  if (!addressesParam) {
    return NextResponse.json({ error: 'Addresses required' }, { status: 400 });
  }

  const addresses = addressesParam.split(',').map((a) => a.trim().toLowerCase());

  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('wallet_assets')
      .select('address, total_assets, updated_at')
      .in('address', addresses);

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message, results: {} });
    }

    // 결과를 주소 -> 자산 맵으로 변환
    const results: Record<string, string | null> = {};
    for (const addr of addresses) {
      const found = data?.find((d) => d.address.toLowerCase() === addr.toLowerCase());
      results[addr] = found?.total_assets || null;
    }

    // 마지막 업데이트 시간
    const lastUpdated = data?.length ? data[0].updated_at : null;

    return NextResponse.json({
      success: true,
      results,
      lastUpdated,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      results: {},
    });
  }
}

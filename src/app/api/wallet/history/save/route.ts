import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 분석 대상 지갑 주소 (4개)
const ANALYSIS_ADDRESSES = [
  '0x3654378aa2deb0860c2e5c7906471c8704c44c6f', // 바이백펀드
  '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7', // 아돌펀드
  '0xD57423c54F188220862391A069a2942c725ee37B', // Aqua1 펀드
  '0xfd48a5FFE5127896E93BAA8074CE98c5a999Ea97', // v3 수수료 펀드(40%)
];

// Supabase 클라이언트
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// GET: 자정에 호출되어 현재 자산을 히스토리에 저장
export async function GET() {
  console.log('[History Save] Starting...');

  try {
    const supabase = getSupabase();

    // 1. wallet_assets에서 현재 자산 가져오기
    const { data: currentAssets, error: fetchError } = await supabase
      .from('wallet_assets')
      .select('address, total_assets')
      .in('address', ANALYSIS_ADDRESSES.map(a => a.toLowerCase()));

    if (fetchError) {
      console.error('[History Save] Fetch error:', fetchError);
      return NextResponse.json({ success: false, error: fetchError.message });
    }

    if (!currentAssets || currentAssets.length === 0) {
      console.log('[History Save] No current assets found');
      return NextResponse.json({ success: false, error: 'No current assets found' });
    }

    // 2. 히스토리 테이블에 저장
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const historyData = currentAssets.map((asset) => ({
      address: asset.address.toLowerCase(),
      total_assets: asset.total_assets,
      recorded_at: today,
    }));

    console.log('[History Save] Saving history:', historyData);

    const { error: insertError } = await supabase
      .from('wallet_assets_history')
      .upsert(historyData, { onConflict: 'address,recorded_at' });

    if (insertError) {
      console.error('[History Save] Insert error:', insertError);
      return NextResponse.json({ success: false, error: insertError.message });
    }

    console.log('[History Save] Success!');
    return NextResponse.json({
      success: true,
      message: `Saved ${historyData.length} records for ${today}`,
      data: historyData,
    });
  } catch (error) {
    console.error('[History Save] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트
function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// GET: 토큰 히스토리 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenName = searchParams.get('token');
  
  if (!tokenName) {
    return NextResponse.json({ 
      success: false, 
      error: 'Token name required' 
    }, { status: 400 });
  }
  
  try {
    const supabase = getSupabase();
    
    // 최근 90일 데이터 조회
    const { data, error } = await supabase
      .from('token_burn')
      .select('*')
      .eq('token_name', tokenName)
      .order('recorded_at', { ascending: false })
      .limit(90);
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      });
    }
    
    return NextResponse.json({
      success: true,
      tokenName,
      history: data || [],
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

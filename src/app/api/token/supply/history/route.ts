import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// GET: 토큰 공급량 히스토리 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get('days') || '365', 10);
  
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('token_supply_history')
      .select('*')
      .order('recorded_at', { ascending: true })
      .limit(days);
    
    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message, history: [] });
    }
    
    return NextResponse.json({
      success: true,
      history: data || [],
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      history: [],
    });
  }
}

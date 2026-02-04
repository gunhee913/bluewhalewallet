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

// SHELL CLUB 멤버 목록 (이미 가입된 멤버)
const SHELL_CLUB_MEMBERS = [
  { name: '홀더(1)', address: '0x22BA71BB6C79cC15f3878f5dFbc262BBB28e7770' },
];

// POST: 가입 신청
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address) {
      return NextResponse.json({ success: false, error: '지갑 주소를 입력해주세요' }, { status: 400 });
    }

    // 주소 형식 검증
    const normalizedAddress = address.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(normalizedAddress)) {
      return NextResponse.json({ success: false, error: '올바른 지갑 주소 형식이 아닙니다' }, { status: 400 });
    }

    // 이미 멤버인지 확인
    const isMember = SHELL_CLUB_MEMBERS.some(
      m => m.address.toLowerCase() === normalizedAddress
    );
    if (isMember) {
      return NextResponse.json({ success: false, error: '이미 클럽 멤버입니다' }, { status: 400 });
    }

    const supabase = getSupabase();

    // 이미 신청했는지 확인
    const { data: existing } = await supabase
      .from('shell_club_applications')
      .select('id, status')
      .eq('address', normalizedAddress)
      .single();

    if (existing) {
      if (existing.status === 'pending') {
        return NextResponse.json({ success: false, error: '이미 가입 신청 중입니다' }, { status: 400 });
      }
      if (existing.status === 'approved') {
        return NextResponse.json({ success: false, error: '이미 승인된 신청입니다' }, { status: 400 });
      }
    }

    // 신청 저장
    const { error } = await supabase
      .from('shell_club_applications')
      .upsert({
        address: normalizedAddress,
        status: 'pending',
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'address',
      });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: '신청 저장 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '가입 신청이 완료되었습니다' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '오류가 발생했습니다',
    }, { status: 500 });
  }
}

// GET: 신청 목록 조회 (관리용)
export async function GET() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('shell_club_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true, applications: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

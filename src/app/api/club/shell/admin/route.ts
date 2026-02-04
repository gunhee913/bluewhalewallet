import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  
  return createClient(url, key);
}

// 관리자 이메일 목록
const ADMIN_EMAILS = [
  'gunhee913@gmail.com',
];

// 관리자 체크
async function isAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return false;
  return ADMIN_EMAILS.includes(session.user.email);
}

// GET: 가입 신청 목록 조회
export async function GET() {
  try {
    // 관리자 체크
    if (!await isAdmin()) {
      return NextResponse.json({ success: false, error: '권한이 없습니다' }, { status: 403 });
    }

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

// POST: 승인/거절 처리
export async function POST(request: NextRequest) {
  try {
    // 관리자 체크
    if (!await isAdmin()) {
      return NextResponse.json({ success: false, error: '권한이 없습니다' }, { status: 403 });
    }

    const body = await request.json();
    const { address, action, name } = body;

    if (!address || !action) {
      return NextResponse.json({ success: false, error: 'address와 action이 필요합니다' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'action은 approve 또는 reject여야 합니다' }, { status: 400 });
    }

    const supabase = getSupabase();

    if (action === 'approve') {
      // 승인 처리
      const { error } = await supabase
        .from('shell_club_applications')
        .update({
          status: 'approved',
          name: name || null,
          approved_at: new Date().toISOString(),
        })
        .eq('address', address.toLowerCase());

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ success: false, error: error.message });
      }

      return NextResponse.json({ success: true, message: '승인되었습니다' });
    } else {
      // 거절 처리
      const { error } = await supabase
        .from('shell_club_applications')
        .update({
          status: 'rejected',
        })
        .eq('address', address.toLowerCase());

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ success: false, error: error.message });
      }

      return NextResponse.json({ success: true, message: '거절되었습니다' });
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// DELETE: 신청 삭제
export async function DELETE(request: NextRequest) {
  try {
    // 관리자 체크
    if (!await isAdmin()) {
      return NextResponse.json({ success: false, error: '권한이 없습니다' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ success: false, error: 'address가 필요합니다' }, { status: 400 });
    }

    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('shell_club_applications')
      .delete()
      .eq('address', address.toLowerCase());

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true, message: '삭제되었습니다' });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

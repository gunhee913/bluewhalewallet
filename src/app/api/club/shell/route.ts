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

// SHELL CLUB 멤버 목록
const SHELL_CLUB_MEMBERS = [
  { name: '멤버1', address: '0x22BA71BB6C79cC15f3878f5dFbc262BBB28e7770' },
];

const TARGET_AMOUNT = 100_000_000; // 1억개

// SHELL 총 발행량 가져오기
async function getShellTotalSupply(supabase: ReturnType<typeof getSupabase>): Promise<number> {
  const { data } = await supabase
    .from('token_info')
    .select('total_supply')
    .eq('token_name', 'SHELL')
    .single();
  
  return data?.total_supply || 10_000_000_000; // 기본값 100억
}

// GET: SHELL CLUB 데이터 조회
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const timeFrame = searchParams.get('timeFrame') || 'daily';

  try {
    const supabase = getSupabase();

    // SHELL 총 발행량 가져오기
    const shellTotalSupply = await getShellTotalSupply(supabase);

    // 특정 멤버 조회
    if (address) {
      const { data, error } = await supabase
        .from('shell_club_holdings')
        .select('*')
        .eq('address', address.toLowerCase())
        .order('recorded_at', { ascending: false })
        .limit(90);

      if (error) {
        console.error('Supabase error:', error);
        return NextResponse.json({ success: false, error: error.message });
      }

      // 최신 데이터
      const latest = data?.[0];

      // 히스토리 데이터 가공 (지분율은 총 발행량 대비)
      const history = (data || []).map((item, index, arr) => {
        const prev = arr[index + 1];
        const change = prev ? Number(item.shell_amount) - Number(prev.shell_amount) : 0;
        const changeValue = prev ? Number(item.shell_value) - Number(prev.shell_value) : 0;
        const [, month, day] = item.recorded_at.split('-');
        
        return {
          date: `${parseInt(month)}/${parseInt(day)}`,
          fullDate: item.recorded_at,
          amount: Number(item.shell_amount),
          change,
          changeValue,
          value: Number(item.shell_value),
          share: shellTotalSupply > 0 ? (Number(item.shell_amount) / shellTotalSupply) * 100 : 0,
        };
      }).reverse();

      return NextResponse.json({
        success: true,
        currentAmount: latest ? Number(latest.shell_amount) : 0,
        currentValue: latest ? Number(latest.shell_value) : 0,
        share: shellTotalSupply > 0 && latest ? (Number(latest.shell_amount) / shellTotalSupply) * 100 : 0,
        progress: latest ? (Number(latest.shell_amount) / TARGET_AMOUNT) * 100 : 0,
        history,
      });
    }

    // 전체 멤버 조회
    const addresses = SHELL_CLUB_MEMBERS.map(m => m.address.toLowerCase());
    
    // 각 멤버의 최신 데이터
    const { data: latestData, error } = await supabase
      .from('shell_club_holdings')
      .select('*')
      .in('address', addresses)
      .order('recorded_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message });
    }

    // 각 멤버별 최신 데이터만 추출
    const memberLatest: Record<string, typeof latestData[0]> = {};
    for (const item of latestData || []) {
      const addr = item.address.toLowerCase();
      if (!memberLatest[addr]) {
        memberLatest[addr] = item;
      }
    }

    // 총 합계
    const totalAmount = Object.values(memberLatest).reduce(
      (sum, item) => sum + Number(item.shell_amount), 0
    );
    const totalValue = Object.values(memberLatest).reduce(
      (sum, item) => sum + Number(item.shell_value), 0
    );

    // 멤버 데이터 생성 (지분율은 총 발행량 대비)
    const members = SHELL_CLUB_MEMBERS.map(m => {
      const data = memberLatest[m.address.toLowerCase()];
      const amount = data ? Number(data.shell_amount) : 0;
      const value = data ? Number(data.shell_value) : 0;
      
      return {
        name: m.name,
        address: m.address,
        amount,
        value,
        share: shellTotalSupply > 0 ? (amount / shellTotalSupply) * 100 : 0,
        progress: (amount / TARGET_AMOUNT) * 100,
      };
    });

    // 전체 히스토리 (일별 합계)
    const { data: historyData } = await supabase
      .from('shell_club_holdings')
      .select('recorded_at, shell_amount')
      .in('address', addresses)
      .order('recorded_at', { ascending: false })
      .limit(300);

    // 날짜별 합계
    const dailyTotals: Record<string, number> = {};
    for (const item of historyData || []) {
      const date = item.recorded_at;
      dailyTotals[date] = (dailyTotals[date] || 0) + Number(item.shell_amount);
    }

    const history = Object.entries(dailyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => {
        const [, month, day] = date.split('-');
        return {
          date: `${parseInt(month)}/${parseInt(day)}`,
          amount,
        };
      });

    return NextResponse.json({
      success: true,
      totalAmount,
      totalValue,
      members,
      history,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// POST: SHELL 보유량 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, shell_amount, shell_value, shell_price, recorded_at } = body;

    if (!address || shell_amount === undefined) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('shell_club_holdings')
      .upsert({
        address: address.toLowerCase(),
        shell_amount,
        shell_value: shell_value || 0,
        shell_price: shell_price || 0,
        recorded_at: recorded_at || new Date().toISOString().split('T')[0],
      }, {
        onConflict: 'address,recorded_at',
      });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ success: false, error: error.message });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

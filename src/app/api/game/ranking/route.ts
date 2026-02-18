import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase credentials not configured');
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('game_rankings')
      .select('*')
      .order('score', { ascending: false })
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ success: true, rankings: data });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nickname, score, tierReached, goldEarned, killCount, playTimeMs } = body;

    if (!nickname || typeof score !== 'number') {
      return NextResponse.json({ success: false, error: 'Invalid data' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('game_rankings')
      .insert([{
        nickname: String(nickname).slice(0, 12),
        score,
        tier_reached: tierReached ?? 1,
        gold_earned: goldEarned ?? 0,
        kill_count: killCount ?? 0,
        play_time_ms: playTimeMs ?? 0,
      }])
      .select()
      .single();

    if (error) throw error;

    const { data: rank } = await supabase
      .from('game_rankings')
      .select('id')
      .gte('score', score)
      .order('score', { ascending: false });

    const myRank = rank ? rank.findIndex((r: any) => r.id === data.id) + 1 : null;

    return NextResponse.json({ success: true, record: data, rank: myRank });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

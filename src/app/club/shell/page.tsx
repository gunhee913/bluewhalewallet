'use client';

import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { SHELL_CLUB_MEMBERS, SHELL_TARGET_AMOUNT } from '@/constants/shell-club';

const PUMPSPACE_BASE_URL = 'https://pumpspace.io/wallet/detail?account=';
const TARGET_AMOUNT = SHELL_TARGET_AMOUNT;

export default function ShellClubPage() {
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // API에서 SHELL 보유량 데이터 가져오기
  const { data: clubData, isLoading } = useQuery({
    queryKey: ['shell-club'],
    queryFn: async () => {
      const response = await fetch('/api/club/shell');
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      if (!data.success) {
        // API 실패 시 기본값 반환
        return {
          totalAmount: 0,
          totalValue: 0,
          members: SHELL_CLUB_MEMBERS.map(m => ({
            ...m,
            amount: 0,
            value: 0,
            share: 0,
            progress: 0,
          })),
          history: [] as { date: string; amount: number }[],
        };
      }
      
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const formatCompact = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
    return num.toString();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // 차트 데이터 (API에서 이미 변환됨)
  const chartData = useMemo(() => {
    if (!clubData?.history) return [];
    return clubData.history;
  }, [clubData?.history]);

  // Y축 Nice Number 계산
  const yAxisConfig = useMemo(() => {
    if (chartData.length === 0) return { domain: [0, 100], ticks: [0, 25, 50, 75, 100] };
    
    const values = chartData.map(d => d.amount);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const range = dataMax - dataMin;
    const padding = range > 0 ? range * 0.5 : dataMin * 0.1;
    
    const rawMin = Math.max(0, dataMin - padding);
    const rawMax = dataMax + padding;
    const totalRange = rawMax - rawMin;
    
    const roughStep = totalRange / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const residual = roughStep / magnitude;
    let niceStep;
    if (residual <= 1.5) niceStep = magnitude;
    else if (residual <= 3) niceStep = 2 * magnitude;
    else if (residual <= 7) niceStep = 5 * magnitude;
    else niceStep = 10 * magnitude;
    
    const niceMin = Math.floor(rawMin / niceStep) * niceStep;
    const niceMax = Math.ceil(rawMax / niceStep) * niceStep;
    
    const ticks: number[] = [];
    for (let tick = niceMin; tick <= niceMax; tick += niceStep) {
      ticks.push(tick);
    }
    
    return { domain: [niceMin, niceMax] as [number, number], ticks };
  }, [chartData]);

  const timeFrameLabel = {
    daily: '일간',
    weekly: '주간',
    monthly: '월간',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <Link
            href="/?tab=club"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>돌아가기</span>
          </Link>
          <div className="flex items-center gap-3">
            <img src="/SHELL.svg" alt="SHELL" className="w-10 h-10 rounded-full" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">SHELL CLUB</h1>
              <p className="text-sm text-slate-400">클럽 분석</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 통계 카드 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">홀더 보유량</p>
              <p className="text-xl md:text-2xl font-bold text-emerald-400">
                {clubData ? formatNumber(clubData.totalAmount) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">홀더 보유가치</p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {clubData?.totalValue ? `$${Math.floor(clubData.totalValue).toLocaleString()}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">멤버 수</p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {SHELL_CLUB_MEMBERS.length}명
              </p>
            </div>
          </div>
        </Card>

        {/* 시간 프레임 탭 */}
        <div className="flex gap-2 mb-4 md:mb-6">
          {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeFrame === tf
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {timeFrameLabel[tf]}
            </button>
          ))}
        </div>

        {/* 차트 */}
        {isLoading ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
            <div className="flex items-center justify-center h-48 md:h-64">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          </Card>
        ) : chartData.length > 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">
              전체 보유량 그래프
            </h2>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={Math.floor(chartData.length / 5)}
                    tickMargin={8}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(value) => formatCompact(value)}
                    width={45}
                    domain={yAxisConfig.domain}
                    ticks={yAxisConfig.ticks}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullDate;
                      }
                      return label;
                    }}
                    formatter={(value: number) => [
                      `${formatNumber(value)} SHELL`,
                      '보유량'
                    ]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#34d399" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5, fill: '#34d399', stroke: 'none' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ) : null}

        {/* 멤버 현황 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h2 className="text-base md:text-lg font-semibold text-white">멤버 현황</h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : SHELL_CLUB_MEMBERS.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p>아직 등록된 멤버가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-center text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">액션</th>
                    <th className="text-left text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">지갑</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">보유량</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">보유가치</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">지분율</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">1억 달성</th>
                  </tr>
                </thead>
                <tbody>
                  {clubData?.members
                    .slice()
                    .sort((a, b) => b.amount - a.amount)
                    .map((member) => (
                    <tr key={member.address} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="text-center px-3 py-4 whitespace-nowrap">
                        <Link
                          href={`/club/shell/${member.address}`}
                          className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-sm rounded transition-colors"
                        >
                          분석
                        </Link>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-mono">
                            {formatAddress(member.address)}
                          </span>
                          <a
                            href={`${PUMPSPACE_BASE_URL}${member.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-slate-500 hover:text-slate-300"
                          >
                            ↗
                          </a>
                        </div>
                      </td>
                      <td className="text-right px-3 py-4 text-sm text-emerald-400 font-medium whitespace-nowrap">
                        {formatNumber(member.amount)}
                      </td>
                      <td className="text-right px-3 py-4 text-sm text-white whitespace-nowrap">
                        ${Math.floor(member.value).toLocaleString()}
                      </td>
                      <td className="text-right px-3 py-4 text-sm text-slate-300 whitespace-nowrap">
                        {member.share.toFixed(2)}%
                      </td>
                      <td className="text-right px-3 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${member.progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                              style={{ width: `${Math.min(member.progress, 100)}%` }}
                            />
                          </div>
                          <span className={`w-16 text-right text-sm ${member.progress >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {member.progress >= 100 ? '✓' : `${member.progress.toFixed(2)}%`}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

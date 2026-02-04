'use client';

import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, use } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const PUMPSPACE_BASE_URL = 'https://pumpspace.io/wallet/detail?account=';

// 목표 보유량 (1억개)
const TARGET_AMOUNT = 100_000_000;

// SHELL CLUB 멤버 지갑들
const SHELL_CLUB_MEMBERS: { name: string; address: string }[] = [
  { name: '멤버1', address: '0x22BA71BB6C79cC15f3878f5dFbc262BBB28e7770' },
];

interface PageProps {
  params: Promise<{ address: string }>;
}

export default function ShellMemberPage({ params }: PageProps) {
  const { address } = use(params);
  const [timeFrame, setTimeFrame] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // 멤버 정보 찾기
  const memberInfo = SHELL_CLUB_MEMBERS.find(
    m => m.address.toLowerCase() === address.toLowerCase()
  );

  // API에서 SHELL 보유량 데이터 가져오기
  const { data: memberData, isLoading } = useQuery({
    queryKey: ['shell-member', address, timeFrame],
    queryFn: async () => {
      const response = await fetch(`/api/club/shell?address=${address}&timeFrame=${timeFrame}`);
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      
      if (!data.success) {
        return {
          currentAmount: 0,
          currentValue: 0,
          share: 0,
          progress: 0,
          history: [] as { 
            date: string; 
            fullDate: string;
            amount: number; 
            change: number;
            changeValue: number;
            value: number;
            share: number;
          }[],
        };
      }
      
      return data;
    },
    staleTime: 30 * 60 * 1000,
  });

  const formatNumber = (num: number) => {
    return Math.floor(num).toLocaleString();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // 차트 데이터
  const chartData = useMemo(() => {
    if (!memberData?.history) return [];
    return memberData.history;
  }, [memberData?.history]);

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

  const remainingAmount = TARGET_AMOUNT - (memberData?.currentAmount || 0);
  const progress = ((memberData?.currentAmount || 0) / TARGET_AMOUNT) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <Link
            href="/club/shell"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>돌아가기</span>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/SHELL.svg" alt="SHELL" className="w-10 h-10 rounded-full" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">
                  {memberInfo?.name || formatAddress(address)}
                </h1>
                <code className="text-xs md:text-sm text-slate-400 font-mono">
                  {formatAddress(address)}
                </code>
              </div>
            </div>
            <a
              href={`${PUMPSPACE_BASE_URL}${address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-colors text-sm"
            >
              <span>PumpSpace</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 통계 카드 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">현재 보유량</p>
              <p className="text-xl md:text-2xl font-bold text-emerald-400">
                {memberData ? formatNumber(memberData.currentAmount) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">보유가치</p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {memberData?.currentValue ? `$${Math.floor(memberData.currentValue).toLocaleString()}` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">지분율</p>
              <p className="text-xl md:text-2xl font-bold text-white">
                {memberData ? `${memberData.share.toFixed(2)}%` : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">목표까지</p>
              <p className="text-xl md:text-2xl font-bold text-amber-400">
                {remainingAmount > 0 ? formatNumber(remainingAmount) : '달성! ✓'}
              </p>
            </div>
          </div>

          {/* 1억개 달성 프로그레스 바 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400">1억개 달성률</span>
              <span className={`text-sm font-medium ${progress >= 100 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {progress.toFixed(1)}%
              </span>
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        </Card>

        {/* 차트 섹션 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base md:text-lg font-semibold text-white">보유량 추이</h3>
            <div className="flex gap-2">
              {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-3 py-1 text-xs md:text-sm rounded-md transition-colors ${
                    timeFrame === tf
                      ? 'bg-slate-600 text-white'
                      : 'bg-slate-700/50 text-slate-400 hover:text-white'
                  }`}
                >
                  {timeFrameLabel[tf]}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="h-[200px] md:h-[300px] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : chartData.length > 0 ? (
            <div className="h-[200px] md:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    fontSize={10}
                    tickMargin={10}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(value) => formatNumber(value)}
                    width={55}
                    domain={yAxisConfig.domain}
                    ticks={yAxisConfig.ticks}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1e293b', 
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [formatNumber(value) + ' SHELL', '보유량']}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] md:h-[300px] flex items-center justify-center text-slate-500">
              데이터가 없습니다
            </div>
          )}
        </Card>

        {/* 히스토리 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold text-white mb-4">보유량 히스토리</h3>
          
          {chartData.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              히스토리 데이터가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-3 text-xs md:text-sm text-slate-400 font-medium whitespace-nowrap">날짜</th>
                    <th className="text-right py-3 px-3 text-xs md:text-sm text-slate-400 font-medium whitespace-nowrap">보유량</th>
                    <th className="text-right py-3 px-3 text-xs md:text-sm text-slate-400 font-medium whitespace-nowrap">증감</th>
                    <th className="text-right py-3 px-3 text-xs md:text-sm text-slate-400 font-medium whitespace-nowrap">증감액</th>
                    <th className="text-right py-3 px-3 text-xs md:text-sm text-slate-400 font-medium whitespace-nowrap">보유가치</th>
                    <th className="text-right py-3 px-3 text-xs md:text-sm text-slate-400 font-medium whitespace-nowrap">지분율</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((item, index) => (
                    <tr key={index} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-3 text-xs md:text-sm text-white whitespace-nowrap">
                        {item.fullDate}
                      </td>
                      <td className="text-right py-3 px-3 text-xs md:text-sm text-emerald-400 font-medium whitespace-nowrap">
                        {formatNumber(item.amount)}
                      </td>
                      <td className="text-right py-3 px-3 text-xs md:text-sm whitespace-nowrap">
                        <span className={item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {item.change >= 0 ? '+' : ''}{formatNumber(item.change)}
                        </span>
                      </td>
                      <td className="text-right py-3 px-3 text-xs md:text-sm whitespace-nowrap">
                        <span className={item.changeValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {item.changeValue >= 0 ? '+' : ''}${Math.floor(item.changeValue).toLocaleString()}
                        </span>
                      </td>
                      <td className="text-right py-3 px-3 text-xs md:text-sm text-white whitespace-nowrap">
                        ${Math.floor(item.value).toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-3 text-xs md:text-sm text-slate-300 whitespace-nowrap">
                        {item.share.toFixed(2)}%
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

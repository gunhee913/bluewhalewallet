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
import { SHELL_CLUB_MEMBERS, SHELL_TARGET_AMOUNT } from '@/constants/shell-club';

const PUMPSPACE_BASE_URL = 'https://pumpspace.io/wallet/detail?account=';
const TARGET_AMOUNT = SHELL_TARGET_AMOUNT;

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

  const formatCompact = (num: number) => {
    if (num >= 1_000_000) {
      const val = num / 1_000_000;
      return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
    }
    if (num >= 1_000) {
      const val = num / 1_000;
      return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  // 차트 데이터 (날짜 형식 변환)
  const chartData = useMemo(() => {
    if (!memberData?.history) return [];
    return memberData.history.map(item => {
      const [, month, day] = item.fullDate.split('-');
      return {
        ...item,
        date: `${parseInt(month)}/${parseInt(day)}`,
      };
    });
  }, [memberData?.history]);


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
              보유량 그래프
            </h2>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
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
                    width={50}
                    domain={['dataMin * 0.95', 'dataMax * 1.05']}
                    tickCount={5}
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

        {/* 보유 현황 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h2 className="text-base md:text-lg font-semibold text-white">보유 현황</h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p>아직 기록된 데이터가 없습니다</p>
              <p className="text-sm mt-1">매일 자정에 데이터가 저장됩니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">날짜</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">보유량</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">증감</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">증감액</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">보유가치</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-3 py-4 whitespace-nowrap">지분율</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((item, index) => {
                    const shortDate = item.fullDate.replace(/^20/, '').replace(/-/g, '.');
                    return (
                      <tr key={index} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-3 py-4 text-sm text-white whitespace-nowrap">
                          {shortDate}
                        </td>
                        <td className="text-right px-3 py-4 text-sm text-emerald-400 font-medium whitespace-nowrap">
                          {formatNumber(item.amount)}
                        </td>
                        <td className="text-right px-3 py-4 text-sm whitespace-nowrap">
                          <span className={item.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {item.change >= 0 ? '+' : ''}{formatNumber(item.change)}
                          </span>
                        </td>
                        <td className="text-right px-3 py-4 text-sm whitespace-nowrap">
                          <span className={item.changeValue >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {item.changeValue >= 0 ? '+' : ''}${Math.floor(item.changeValue).toLocaleString()}
                          </span>
                        </td>
                        <td className="text-right px-3 py-4 text-sm text-white whitespace-nowrap">
                          ${Math.floor(item.value).toLocaleString()}
                        </td>
                        <td className="text-right px-3 py-4 text-sm text-slate-300 whitespace-nowrap">
                          {item.share.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

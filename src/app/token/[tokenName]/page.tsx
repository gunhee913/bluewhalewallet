'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// 토큰 이미지
const TOKEN_IMAGES: Record<string, string> = {
  'sBWPM': '/sBWPM.svg',
  'sADOL': '/sADOL.svg',
  'AQUA1': '/AQUA1.svg',
  'CLAM': '/CLAM.svg',
  'PEARL': '/PEARL.svg',
  'SHELL': '/SHELL.svg',
  'CORAL': '/CORAL.png',
};

interface HistoryItem {
  recorded_at: string;
  burned_amount: number;
  burned_value: string;
  token_price: number;
  total_supply: number;
}

type TimeFrame = 'daily' | 'weekly' | 'monthly';

async function fetchTokenHistory(tokenName: string): Promise<HistoryItem[]> {
  const response = await fetch(`/api/token/history?token=${tokenName}`);
  if (!response.ok) throw new Error('Failed to fetch history');
  const data = await response.json();
  return data.history || [];
}

export default function TokenDetailPage() {
  const params = useParams();
  const tokenName = params.tokenName as string;
  const tokenImage = TOKEN_IMAGES[tokenName];
  
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const { data: history, isLoading } = useQuery({
    queryKey: ['token-history', tokenName],
    queryFn: () => fetchTokenHistory(tokenName),
  });

  // 일일 소각량 계산 (오늘 - 전날)
  const historyWithDaily = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    const sorted = [...history].sort((a, b) => 
      new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
    );
    
    return sorted.map((item, index) => {
      const prevItem = index > 0 ? sorted[index - 1] : null;
      const dailyBurn = prevItem 
        ? item.burned_amount - prevItem.burned_amount 
        : 0;
      const dailyValue = dailyBurn * (item.token_price || 0);
      
      return {
        ...item,
        dailyBurn: Math.max(0, dailyBurn),
        dailyValue,
      };
    }).reverse();
  }, [history]);

  // 시간 프레임에 따른 필터링
  const filteredHistory = useMemo(() => {
    if (!historyWithDaily) return [];
    
    switch (timeFrame) {
      case 'weekly':
        return historyWithDaily.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDay() === 1;
        });
      case 'monthly':
        return historyWithDaily.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDate() === 1;
        });
      default:
        return historyWithDaily.slice(0, 90);
    }
  }, [historyWithDaily, timeFrame]);

  // 차트 데이터 (누적 소각량)
  const chartData = useMemo(() => {
    return [...filteredHistory].reverse().map((item) => {
      const [, month, day] = item.recorded_at.split('-');
      return {
        date: `${parseInt(month)}/${parseInt(day)}`,
        fullDate: item.recorded_at,
        amount: item.burned_amount,
      };
    });
  }, [filteredHistory]);

  // X축 간격 계산
  const xAxisInterval = useMemo(() => {
    if (timeFrame === 'daily') return Math.floor(chartData.length / 5);
    if (timeFrame === 'weekly') return 7;
    if (timeFrame === 'monthly') return 1;
    return 0;
  }, [timeFrame, chartData.length]);

  const formatNumber = (num: number, withDecimal: boolean = false) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: withDecimal ? 4 : 0 });
  };

  const showDecimal = tokenName === 'sBWPM' || tokenName === 'sADOL';

  const timeFrameLabel = {
    daily: '일간',
    weekly: '주간',
    monthly: '월간',
  };

  if (!tokenImage) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">토큰을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <Link
            href="/?tab=token"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>돌아가기</span>
          </Link>
          <div className="flex items-center gap-3">
            <img 
              src={tokenImage} 
              alt={tokenName} 
              className="w-8 h-8 md:w-10 md:h-10 rounded-full"
            />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">{tokenName}</h1>
              <p className="text-xs md:text-sm text-slate-400">소각 분석</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 시간 프레임 탭 */}
        <div className="flex gap-2 mb-4 md:mb-6">
          {(['daily', 'weekly', 'monthly'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => {
                setTimeFrame(tf);
                setVisibleCount(20);
              }}
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
              누적 소각량 그래프
            </h2>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    fontSize={10}
                    interval={xAxisInterval}
                    tickMargin={8}
                  />
                  <YAxis 
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      if (value >= 1) return value.toFixed(showDecimal ? 1 : 0);
                      return value.toFixed(2);
                    }}
                    width={45}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: '#94a3b8' }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0]) {
                        return payload[0].payload.fullDate;
                      }
                      return label;
                    }}
                    formatter={(value: number) => [
                      `${formatNumber(value, showDecimal)} 개`,
                      '누적 소각량'
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

        {/* 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h2 className="text-base md:text-lg font-semibold text-white">소각 현황</h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="text-left text-xs md:text-sm font-medium text-slate-400 px-3 py-3">날짜</th>
                      <th className="text-right text-xs md:text-sm font-medium text-slate-400 px-2 py-3">일소각량</th>
                      <th className="text-right text-xs md:text-sm font-medium text-slate-400 px-2 py-3">일소각금</th>
                      <th className="text-right text-xs md:text-sm font-medium text-slate-400 px-2 py-3">누적소각량</th>
                      <th className="text-right text-xs md:text-sm font-medium text-slate-400 px-2 py-3">총소각가치</th>
                      <th className="text-right text-xs md:text-sm font-medium text-slate-400 px-3 py-3">소각률</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, visibleCount).map((item, index) => {
                      const totalSupply = item.total_supply || 0;
                      const burnRate = totalSupply > 0 
                        ? (item.burned_amount / totalSupply) * 100 
                        : 0;
                      
                      return (
                        <tr 
                          key={index} 
                          className="border-t border-slate-700/50 hover:bg-slate-700/30"
                        >
                          <td className="px-3 py-3 text-xs md:text-sm text-white whitespace-nowrap">
                            {item.recorded_at}
                          </td>
                          <td className="px-2 py-3 text-right text-xs md:text-sm text-orange-400 font-mono">
                            {formatNumber(item.dailyBurn, showDecimal)}
                          </td>
                          <td className="px-2 py-3 text-right text-xs md:text-sm text-yellow-400">
                            {item.dailyValue > 0 ? `$${formatNumber(item.dailyValue)}` : '-'}
                          </td>
                          <td className="px-2 py-3 text-right text-xs md:text-sm text-orange-400 font-mono">
                            {formatNumber(item.burned_amount, showDecimal)}
                          </td>
                          <td className="px-2 py-3 text-right text-xs md:text-sm text-emerald-400">
                            {item.burned_value || '-'}
                          </td>
                          <td className="px-3 py-3 text-right text-xs md:text-sm text-white">
                            {burnRate > 0 ? `${burnRate.toFixed(2)}%` : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {visibleCount < filteredHistory.length && (
                <div className="p-4 border-t border-slate-700">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 20)}
                    className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                  >
                    더보기
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-10 text-slate-400">
              <p>아직 기록된 데이터가 없습니다</p>
              <p className="text-sm mt-1">매일 자정에 데이터가 저장됩니다</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

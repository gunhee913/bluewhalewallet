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

// 토큰 정보
const TOKEN_INFO: Record<string, { totalSupply: number; image: string }> = {
  'sBWPM': { totalSupply: 7000, image: '/sBWPM.svg' },
  'sADOL': { totalSupply: 70000, image: '/sADOL.svg' },
  'AQUA1': { totalSupply: 0, image: '/AQUA1.svg' },
  'CLAM': { totalSupply: 70000000, image: '/CLAM.svg' },
  'PEARL': { totalSupply: 0, image: '/PEARL.svg' },
  'SHELL': { totalSupply: 0, image: '/SHELL.svg' },
  'CORAL': { totalSupply: 0, image: '/CORAL.png' },
};

interface HistoryItem {
  recorded_at: string;
  burned_amount: number;
  burned_value: string;
  token_price: number;
  total_supply: number;
}

type TimeFrame = 'daily' | 'weekly' | 'monthly';
type TabType = 'cumulative' | 'daily';

async function fetchTokenHistory(tokenName: string): Promise<HistoryItem[]> {
  const response = await fetch(`/api/token/history?token=${tokenName}`);
  if (!response.ok) throw new Error('Failed to fetch history');
  const data = await response.json();
  return data.history || [];
}

export default function TokenDetailPage() {
  const params = useParams();
  const tokenName = params.tokenName as string;
  const tokenInfo = TOKEN_INFO[tokenName];
  
  const [selectedTab, setSelectedTab] = useState<TabType>('cumulative');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  const { data: history, isLoading } = useQuery({
    queryKey: ['token-history', tokenName],
    queryFn: () => fetchTokenHistory(tokenName),
  });

  // 일일 소각량 계산 (오늘 - 전날)
  const historyWithDaily = useMemo(() => {
    if (!history || history.length === 0) return [];
    
    // 날짜 오름차순 정렬
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
        dailyBurn: Math.max(0, dailyBurn), // 음수 방지
        dailyValue,
      };
    }).reverse(); // 최신순으로 다시 정렬
  }, [history]);

  // 시간 프레임에 따른 필터링
  const filteredHistory = useMemo(() => {
    if (!historyWithDaily) return [];
    
    switch (timeFrame) {
      case 'weekly':
        return historyWithDaily.filter((_, index) => index % 7 === 0);
      case 'monthly':
        return historyWithDaily.filter((_, index) => index % 30 === 0);
      default:
        return historyWithDaily;
    }
  }, [historyWithDaily, timeFrame]);

  // 차트 데이터
  const chartData = useMemo(() => {
    return [...filteredHistory].reverse().map((item) => ({
      date: new Date(item.recorded_at).toLocaleDateString('ko-KR', {
        month: 'short',
        day: 'numeric',
      }),
      value: selectedTab === 'cumulative' ? item.burned_amount : item.dailyBurn,
    }));
  }, [filteredHistory, selectedTab]);

  const formatNumber = (num: number, withDecimal: boolean = false) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: withDecimal ? 4 : 0 });
  };

  const showDecimal = tokenName === 'sBWPM' || tokenName === 'sADOL';

  if (!tokenInfo) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <p className="text-white">토큰을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="p-2 sm:p-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </Link>
            <div className="flex items-center gap-3">
              <img 
                src={tokenInfo.image} 
                alt={tokenName} 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
              />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">{tokenName}</h1>
                <p className="text-xs sm:text-sm text-slate-400">소각 분석</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* 탭 선택 */}
        <div className="flex gap-4 mb-6 border-b border-slate-700/50">
          <button
            onClick={() => setSelectedTab('cumulative')}
            className={`pb-3 text-sm font-medium transition-colors ${
              selectedTab === 'cumulative'
                ? 'text-white border-b-2 border-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            누적 현황
          </button>
          <button
            onClick={() => setSelectedTab('daily')}
            className={`pb-3 text-sm font-medium transition-colors ${
              selectedTab === 'daily'
                ? 'text-white border-b-2 border-white'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            일일 현황
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
          </div>
        ) : (
          <>
            {/* 차트 */}
            <Card className="bg-slate-800/50 border-slate-700/50 p-4 sm:p-6 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <h2 className="text-base sm:text-lg font-semibold text-white">
                  {selectedTab === 'cumulative' ? '누적 소각량' : '일일 소각량'} 그래프
                </h2>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'monthly'] as TimeFrame[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeFrame(tf)}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                        timeFrame === tf
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {tf === 'daily' ? '일간' : tf === 'weekly' ? '주간' : '월간'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-[250px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis 
                      dataKey="date" 
                      stroke="#94a3b8" 
                      fontSize={11}
                      interval={timeFrame === 'daily' ? 'preserveStartEnd' : 0}
                    />
                    <YAxis 
                      stroke="#94a3b8" 
                      fontSize={11}
                      tickFormatter={(val) => formatNumber(val, showDecimal)}
                      width={70}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#94a3b8' }}
                      formatter={(value: number) => [
                        `${formatNumber(value, showDecimal)} 개`,
                        selectedTab === 'cumulative' ? '누적 소각량' : '일일 소각량'
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* 테이블 */}
            <Card className="bg-slate-800/50 border-slate-700/50 p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-white mb-4">
                {selectedTab === 'cumulative' ? '누적 현황' : '일일 현황'} 테이블
              </h2>
              
              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-3 px-2 text-slate-400 font-medium">날짜</th>
                      {selectedTab === 'cumulative' ? (
                        <>
                          <th className="text-right py-3 px-2 text-slate-400 font-medium">누적 소각량</th>
                          <th className="text-right py-3 px-2 text-slate-400 font-medium">소각 가치</th>
                          <th className="text-right py-3 px-2 text-slate-400 font-medium">소각률</th>
                        </>
                      ) : (
                        <>
                          <th className="text-right py-3 px-2 text-slate-400 font-medium">일일 소각량</th>
                          <th className="text-right py-3 px-2 text-slate-400 font-medium">소각 금액</th>
                          <th className="text-right py-3 px-2 text-slate-400 font-medium">토큰 가격</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, visibleCount).map((item, index) => {
                      const burnRate = tokenInfo.totalSupply > 0 
                        ? (item.burned_amount / tokenInfo.totalSupply) * 100 
                        : 0;
                      
                      return (
                        <tr 
                          key={index} 
                          className="border-b border-slate-700/50 hover:bg-slate-700/30"
                        >
                          <td className="py-4 px-2 text-white">
                            {new Date(item.recorded_at).toLocaleDateString('ko-KR', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          {selectedTab === 'cumulative' ? (
                            <>
                              <td className="py-4 px-2 text-right text-orange-400 font-medium">
                                {formatNumber(item.burned_amount, showDecimal)}
                              </td>
                              <td className="py-4 px-2 text-right text-emerald-400">
                                {item.burned_value || '-'}
                              </td>
                              <td className="py-4 px-2 text-right text-white">
                                {burnRate > 0 ? `${burnRate.toFixed(2)}%` : '-'}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-4 px-2 text-right text-orange-400 font-medium">
                                {formatNumber(item.dailyBurn, showDecimal)}
                              </td>
                              <td className="py-4 px-2 text-right text-emerald-400">
                                {item.dailyValue > 0 ? `$${formatNumber(item.dailyValue)}` : '-'}
                              </td>
                              <td className="py-4 px-2 text-right text-white">
                                {item.token_price > 0 ? `$${item.token_price.toFixed(2)}` : '-'}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredHistory.length > visibleCount && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setVisibleCount((prev) => prev + 20)}
                    className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                  >
                    더보기
                  </button>
                </div>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

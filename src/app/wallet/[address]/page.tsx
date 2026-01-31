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

// 지갑 이름 매핑
const WALLET_NAMES: Record<string, string> = {
  '0x3654378aa2deb0860c2e5c7906471c8704c44c6f': '바이백펀드',
  '0xed1b254b6c3a6785e19ba83b728ece4a6444f4d7': '아돌펀드',
  '0xd57423c54f188220862391a069a2942c725ee37b': 'Aqua1 펀드',
  '0xfd48a5ffe5127896e93baa8074ce98c5a999ea97': 'v3 수수료 펀드(40%)',
  '0x525e7f0a5d3fd6169d6ec35288104d52bf3bb95f': '팀 지갑',
};

interface HistoryItem {
  recorded_at: string;
  total_assets: string;
}

type TimeFrame = 'daily' | 'weekly' | 'monthly';

async function fetchWalletHistory(address: string): Promise<HistoryItem[]> {
  const response = await fetch(`/api/wallet/history?address=${address}&days=365`);
  if (!response.ok) throw new Error('Failed to fetch history');
  const data = await response.json();
  return data.history || [];
}

async function fetchCurrentAssets(address: string): Promise<string | null> {
  const response = await fetch(`/api/wallet?addresses=${address}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.results?.[address.toLowerCase()] || null;
}

export default function WalletDetailPage() {
  const params = useParams();
  const address = (params.address as string).toLowerCase();
  const walletName = WALLET_NAMES[address] || '알 수 없는 지갑';
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [visibleCount, setVisibleCount] = useState(20);

  // 페이지 진입 시 스크롤 맨 위로
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['wallet-history', address],
    queryFn: () => fetchWalletHistory(address),
  });

  const { data: currentAssets } = useQuery({
    queryKey: ['wallet-current', address],
    queryFn: () => fetchCurrentAssets(address),
  });

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const formatAssets = (assets: string | null) => {
    if (!assets) return '-';
    return assets.replace(/\.\d+/, '');
  };

  const parseAmount = (assets: string | null): number => {
    if (!assets) return 0;
    return parseFloat(assets.replace(/[$,]/g, '')) || 0;
  };

  const calculateChange = (current: string | null, previous: string | null) => {
    const curr = parseAmount(current);
    const prev = parseAmount(previous);
    if (prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };

  // 시간 프레임에 따른 필터링
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    
    switch (timeFrame) {
      case 'weekly':
        // 월요일만 (dayOfWeek === 1)
        return history.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDay() === 1;
        });
      case 'monthly':
        // 매월 1일만
        return history.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDate() === 1;
        });
      default:
        // 일간: 최근 90일
        return history.slice(0, 90);
    }
  }, [history, timeFrame]);

  // 차트용 데이터 (역순으로 정렬 - 오래된 것부터)
  const chartData = useMemo(() => {
    return [...filteredHistory]
      .reverse()
      .map((item) => {
        const [, month, day] = item.recorded_at.split('-');
        return {
          date: `${parseInt(month)}/${parseInt(day)}`,
          fullDate: item.recorded_at,
          amount: parseAmount(item.total_assets),
        };
      });
  }, [filteredHistory]);

  // X축 간격 계산
  const xAxisInterval = useMemo(() => {
    if (timeFrame === 'daily') return Math.floor(chartData.length / 5);
    if (timeFrame === 'weekly') return 7; // 8주마다 표시
    if (timeFrame === 'monthly') return 1; // 2개월마다 표시
    return 0;
  }, [timeFrame, chartData.length]);

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
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>돌아가기</span>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">{walletName}</h1>
            <code className="text-xs md:text-sm text-slate-400 font-mono">
              {formatAddress(address)}
            </code>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 현재 자산 카드 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">현재 Total Assets</p>
              <p className="text-2xl md:text-3xl font-bold text-emerald-400">
                {formatAssets(currentAssets)}
              </p>
            </div>
            {history && history.length > 0 && (
              <div className="text-right">
                <p className="text-xs md:text-sm text-slate-400 mb-1">어제 대비</p>
                {(() => {
                  const change = calculateChange(currentAssets, history[0]?.total_assets);
                  if (change === null) return <p className="text-slate-500">-</p>;
                  const isPositive = change >= 0;
                  return (
                    <span className={`text-lg md:text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        </Card>

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
        {historyLoading ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
            <div className="flex items-center justify-center h-48 md:h-64">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          </Card>
        ) : chartData.length > 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Total Assets 그래프</h2>
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
                    tickFormatter={(value) => `$${(value / 1000000).toFixed(1)}M`}
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
                    formatter={(value: number) => [`$${value.toLocaleString()}`, 'Total Assets']}
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

        {/* 히스토리 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold text-white">Total Assets 테이블</h2>
            <span className="text-xs md:text-sm text-slate-400">{filteredHistory.length}개</span>
          </div>
          
          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : filteredHistory.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="text-left text-sm md:text-base font-medium text-slate-400 px-4 py-3 md:py-4">날짜</th>
                      <th className="text-right text-sm md:text-base font-medium text-slate-400 px-4 py-3 md:py-4">Total Assets</th>
                      <th className="text-right text-sm md:text-base font-medium text-slate-400 px-4 py-3 md:py-4">변동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, visibleCount).map((item, index) => {
                      const prevItem = filteredHistory[index + 1];
                      const change = calculateChange(item.total_assets, prevItem?.total_assets);
                      const isPositive = change !== null && change >= 0;
                      
                      return (
                        <tr key={item.recorded_at} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td className="px-4 py-4 text-sm md:text-base text-white">{item.recorded_at}</td>
                          <td className="px-4 py-4 text-right text-sm md:text-base text-emerald-400 font-mono">
                            {formatAssets(item.total_assets)}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm md:text-base font-medium ${
                            change === null ? 'text-slate-500' : isPositive ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {change === null ? '-' : `${isPositive ? '+' : ''}${change.toFixed(2)}%`}
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

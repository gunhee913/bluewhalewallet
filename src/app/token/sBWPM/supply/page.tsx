'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface HistoryItem {
  recorded_at: string;
  bwpm_nft: number;
  sbwpm_kaia: number;
  sbwpm_avalanche: number;
  burned_amount: number;
  buyback_amount: number;
}

type TimeFrame = 'daily' | 'weekly' | 'monthly';

async function fetchSupplyHistory(): Promise<HistoryItem[]> {
  const response = await fetch('/api/token/supply/history?days=365');
  if (!response.ok) throw new Error('Failed to fetch history');
  const data = await response.json();
  return data.history || [];
}

async function fetchCurrentSupply() {
  const response = await fetch('/api/token/supply');
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
  return data.tokens?.find((t: { token_name: string }) => t.token_name === 'sBWPM');
}

async function fetchBurnData() {
  const response = await fetch('/api/token/burn');
  if (!response.ok) throw new Error('Failed to fetch');
  const data = await response.json();
  return data.tokens?.find((t: { token_name: string }) => t.token_name === 'sBWPM');
}

export default function SupplyAnalysisPage() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [visibleCount, setVisibleCount] = useState(20);

  // 페이지 진입 시 스크롤 맨 위로
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['supply-history'],
    queryFn: fetchSupplyHistory,
  });

  const { data: currentSupply } = useQuery({
    queryKey: ['current-supply'],
    queryFn: fetchCurrentSupply,
  });

  const { data: burnData } = useQuery({
    queryKey: ['burn-data'],
    queryFn: fetchBurnData,
  });

  // 현재 데이터 계산
  const currentData = useMemo(() => {
    if (!currentSupply) return null;
    const sbwpmTotal = currentSupply.circulating_supply || 0;
    const avalanche = currentSupply.avalanche_balance || 0;
    const buyback = currentSupply.buyback_amount || 0;
    const kaia = sbwpmTotal - avalanche;
    const burned = burnData?.burned_amount || 0;
    const bwpmNft = 7000 - sbwpmTotal;
    
    return {
      bwpmNft,
      kaia: kaia - burned,
      avalanche,
      burned,
      buyback,
    };
  }, [currentSupply, burnData]);

  // 시간 프레임에 따른 필터링
  const filteredHistory = useMemo(() => {
    if (!history) return [];
    
    switch (timeFrame) {
      case 'weekly':
        return history.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDay() === 1;
        });
      case 'monthly':
        return history.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDate() === 1;
        });
      default:
        return history.slice(0, 90);
    }
  }, [history, timeFrame]);

  // 차트용 데이터
  const chartData = useMemo(() => {
    return [...filteredHistory]
      .reverse()
      .map((item) => {
        const [, month, day] = item.recorded_at.split('-');
        return {
          date: `${parseInt(month)}/${parseInt(day)}`,
          fullDate: item.recorded_at,
          bwpmNft: item.bwpm_nft || 0,
          kaia: item.sbwpm_kaia || 0,
          avalanche: item.sbwpm_avalanche || 0,
          burned: item.burned_amount || 0,
          buyback: item.buyback_amount || 0,
        };
      });
  }, [filteredHistory]);

  // 테이블용 데이터 (최신순)
  const tableData = useMemo(() => {
    return [...filteredHistory].reverse().reverse();
  }, [filteredHistory]);

  // X축 간격 계산
  const xAxisInterval = useMemo(() => {
    if (timeFrame === 'daily') return Math.floor(chartData.length / 5);
    if (timeFrame === 'weekly') return 7;
    if (timeFrame === 'monthly') return 1;
    return 0;
  }, [timeFrame, chartData.length]);

  const timeFrameLabel = {
    daily: '일간',
    weekly: '주간',
    monthly: '월간',
  };

  const formatNum = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 });

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
          <div className="flex items-center gap-3">
            <img src="/sBWPM.svg" alt="sBWPM" className="w-10 h-10" />
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">sBWPM 총 발행량 분석</h1>
              <p className="text-xs md:text-sm text-slate-400">총 7,000개 발행</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 현재 현황 카드 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          <h2 className="text-sm text-slate-400 mb-3">현재 분포 현황</h2>
          {currentData ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">BWPM NFT</p>
                <p className="text-lg md:text-xl font-bold text-blue-400">{formatNum(currentData.bwpmNft)}개</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">sBWPM (카이아)</p>
                <p className="text-lg md:text-xl font-bold text-emerald-400">{formatNum(currentData.kaia)}개</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">sBWPM (아발란체)</p>
                <p className="text-lg md:text-xl font-bold text-purple-400">{formatNum(currentData.avalanche)}개</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">바이백</p>
                <p className="text-lg md:text-xl font-bold text-amber-400">{formatNum(currentData.buyback)}개</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">소각량</p>
                <p className="text-lg md:text-xl font-bold text-rose-400">{formatNum(currentData.burned)}개</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}
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
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">발행량 분포 그래프</h2>
            <div className="h-64 md:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
                    tickFormatter={(value) => value.toLocaleString()}
                    width={50}
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
                    formatter={(value: number, name: string) => {
                      const labels: Record<string, string> = {
                        bwpmNft: 'BWPM NFT',
                        kaia: 'sBWPM (카이아)',
                        avalanche: 'sBWPM (아발란체)',
                        buyback: '바이백',
                        burned: '소각량',
                      };
                      return [`${value.toLocaleString()}개`, labels[name] || name];
                    }}
                  />
                  <Legend 
                    formatter={(value) => {
                      const labels: Record<string, string> = {
                        bwpmNft: 'BWPM NFT',
                        kaia: '카이아',
                        avalanche: '아발란체',
                        buyback: '바이백',
                        burned: '소각량',
                      };
                      return labels[value] || value;
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="bwpmNft"
                    stackId="1"
                    stroke="#3b82f6"
                    fill="#3b82f6"
                    fillOpacity={0.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="kaia"
                    stackId="1"
                    stroke="#34d399"
                    fill="#34d399"
                    fillOpacity={0.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="avalanche"
                    stackId="1"
                    stroke="#a855f7"
                    fill="#a855f7"
                    fillOpacity={0.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="buyback"
                    stackId="1"
                    stroke="#f59e0b"
                    fill="#f59e0b"
                    fillOpacity={0.8}
                  />
                  <Area
                    type="monotone"
                    dataKey="burned"
                    stackId="1"
                    stroke="#f43f5e"
                    fill="#f43f5e"
                    fillOpacity={0.8}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        ) : (
          <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
            <div className="text-center py-10 text-slate-400">
              <p>아직 기록된 데이터가 없습니다</p>
              <p className="text-sm mt-1">정오/자정에 데이터가 저장됩니다</p>
            </div>
          </Card>
        )}

        {/* 히스토리 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h2 className="text-base md:text-lg font-semibold text-white">발행량 테이블</h2>
          </div>
          
          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : tableData.length > 0 ? (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full min-w-[700px]">
                  <thead className="bg-slate-800">
                    <tr>
                      <th className="text-left text-sm font-medium text-slate-400 px-4 py-3">날짜</th>
                      <th className="text-right text-sm font-medium text-blue-400 px-4 py-3">BWPM NFT</th>
                      <th className="text-right text-sm font-medium text-emerald-400 px-4 py-3">카이아</th>
                      <th className="text-right text-sm font-medium text-purple-400 px-4 py-3">아발란체</th>
                      <th className="text-right text-sm font-medium text-amber-400 px-4 py-3">바이백</th>
                      <th className="text-right text-sm font-medium text-rose-400 px-4 py-3">소각량</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.slice(0, visibleCount).map((item) => (
                      <tr key={item.recorded_at} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-sm text-white whitespace-nowrap">
                          {item.recorded_at.replace(/^20/, '').replace(/-/g, '.')}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-blue-400 font-mono">
                          {formatNum(item.bwpm_nft || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-emerald-400 font-mono">
                          {formatNum(item.sbwpm_kaia || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-purple-400 font-mono">
                          {formatNum(item.sbwpm_avalanche || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-amber-400 font-mono">
                          {formatNum(item.buyback_amount || 0)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-rose-400 font-mono">
                          {formatNum(item.burned_amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {visibleCount < tableData.length && (
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
              <p className="text-sm mt-1">정오/자정에 데이터가 저장됩니다</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

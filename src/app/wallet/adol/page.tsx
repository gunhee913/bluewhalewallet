'use client';

import { useState, useMemo, useEffect } from 'react';
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

// 아돌펀드 지갑 목록
const ADOL_WALLETS = [
  { id: 'main', name: '메인', address: '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7' },
  { id: 'ai1', name: 'AI(1)', address: '0xe2E6252aBf18680169f8e95aa8f2b5c5E6c05390' },
  { id: 'ai2', name: 'AI(2)', address: '0x8E63231be79fFDFECf46b13FFDE1881fD9C7e231' },
  { id: 'ai3', name: 'AI(3)', address: '0x9Bd2c37535F41cE4FC373cAcee1F7Bd023DC5b9A' },
  { id: 'ai4', name: 'AI(4)', address: '0xC81A059E9A2185A97925d6B7b5D527294c439625' },
];

interface HistoryItem {
  recorded_at: string;
  total_assets: string;
}

type TimeFrame = 'daily' | 'weekly' | 'monthly';
type TabType = 'total' | 'main' | 'ai1' | 'ai2' | 'ai3' | 'ai4';

async function fetchWalletHistory(address: string): Promise<HistoryItem[]> {
  const response = await fetch(`/api/wallet/history?address=${address}&days=365`);
  if (!response.ok) throw new Error('Failed to fetch history');
  const data = await response.json();
  return data.history || [];
}

async function fetchCurrentAssets(addresses: string[]): Promise<Record<string, string | null>> {
  const response = await fetch(`/api/wallet?addresses=${addresses.join(',')}`);
  if (!response.ok) return {};
  const data = await response.json();
  return data.results || {};
}

export default function AdolAnalysisPage() {
  const [selectedTab, setSelectedTab] = useState<TabType>('total');
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  // 모든 지갑 주소
  const allAddresses = ADOL_WALLETS.map(w => w.address);

  // 현재 자산 조회
  const { data: currentAssetsData } = useQuery({
    queryKey: ['adol-current'],
    queryFn: () => fetchCurrentAssets(allAddresses),
  });

  // 선택된 지갑 정보
  const selectedWallet = selectedTab === 'total' 
    ? null 
    : ADOL_WALLETS.find(w => w.id === selectedTab);

  // 히스토리 조회 (개별 지갑)
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['adol-history', selectedWallet?.address],
    queryFn: () => selectedWallet ? fetchWalletHistory(selectedWallet.address) : Promise.resolve([]),
    enabled: !!selectedWallet,
  });

  // 모든 지갑 히스토리 조회 (종합용)
  const { data: allHistories, isLoading: allHistoriesLoading } = useQuery({
    queryKey: ['adol-all-histories'],
    queryFn: async () => {
      const results: Record<string, HistoryItem[]> = {};
      for (const wallet of ADOL_WALLETS) {
        try {
          const history = await fetchWalletHistory(wallet.address);
          results[wallet.address] = history;
        } catch {
          results[wallet.address] = [];
        }
      }
      return results;
    },
    enabled: selectedTab === 'total',
  });

  const parseAmount = (assets: string | null | undefined): number => {
    if (!assets) return 0;
    return parseFloat(assets.replace(/[$,]/g, '')) || 0;
  };

  const formatAssets = (assets: string | null | undefined) => {
    if (!assets) return '-';
    return assets.replace(/\.\d+/, '');
  };

  // 현재 총 자산 계산
  const totalCurrentAssets = useMemo(() => {
    if (!currentAssetsData) return 0;
    return ADOL_WALLETS.reduce((sum, wallet) => {
      const key = Object.keys(currentAssetsData).find(
        k => k.toLowerCase() === wallet.address.toLowerCase()
      );
      return sum + parseAmount(key ? currentAssetsData[key] : null);
    }, 0);
  }, [currentAssetsData]);

  // 선택된 지갑의 현재 자산
  const currentAssets = useMemo(() => {
    if (selectedTab === 'total') {
      return totalCurrentAssets > 0 ? `$${totalCurrentAssets.toLocaleString()}` : null;
    }
    if (!currentAssetsData || !selectedWallet) return null;
    const key = Object.keys(currentAssetsData).find(
      k => k.toLowerCase() === selectedWallet.address.toLowerCase()
    );
    return key ? currentAssetsData[key] : null;
  }, [selectedTab, currentAssetsData, selectedWallet, totalCurrentAssets]);

  // 종합 히스토리 계산
  const combinedHistory = useMemo(() => {
    if (selectedTab !== 'total' || !allHistories) return [];
    
    // 날짜별로 모든 지갑의 자산 합계 계산
    const dateMap: Record<string, number> = {};
    
    Object.values(allHistories).forEach((walletHistory) => {
      walletHistory.forEach((item) => {
        const amount = parseAmount(item.total_assets);
        dateMap[item.recorded_at] = (dateMap[item.recorded_at] || 0) + amount;
      });
    });
    
    return Object.entries(dateMap)
      .map(([date, total]) => ({
        recorded_at: date,
        total_assets: `$${total.toLocaleString()}`,
      }))
      .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  }, [selectedTab, allHistories]);

  // 실제 사용할 히스토리
  const activeHistory = selectedTab === 'total' ? combinedHistory : (history || []);
  const isLoading = selectedTab === 'total' ? allHistoriesLoading : historyLoading;

  // 시간 프레임 필터링
  const filteredHistory = useMemo(() => {
    if (!activeHistory) return [];
    
    switch (timeFrame) {
      case 'weekly':
        return activeHistory.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDay() === 1;
        });
      case 'monthly':
        return activeHistory.filter((item) => {
          const date = new Date(item.recorded_at);
          return date.getDate() === 1;
        });
      default:
        return activeHistory.slice(0, 90);
    }
  }, [activeHistory, timeFrame]);

  // 차트 데이터
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

  const xAxisInterval = useMemo(() => {
    if (timeFrame === 'daily') return Math.floor(chartData.length / 5);
    if (timeFrame === 'weekly') return 7;
    if (timeFrame === 'monthly') return 1;
    return 0;
  }, [timeFrame, chartData.length]);

  const calculateChange = (current: string | null, previous: string | null) => {
    const curr = parseAmount(current);
    const prev = parseAmount(previous);
    if (prev === 0) return null;
    return ((curr - prev) / prev) * 100;
  };

  const timeFrameLabel = {
    daily: '일간',
    weekly: '주간',
    monthly: '월간',
  };

  const tabs: { id: TabType; name: string }[] = [
    { id: 'total', name: '종합' },
    { id: 'main', name: '메인' },
    { id: 'ai1', name: 'AI(1)' },
    { id: 'ai2', name: 'AI(2)' },
    { id: 'ai3', name: 'AI(3)' },
    { id: 'ai4', name: 'AI(4)' },
  ];

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
          <h1 className="text-xl md:text-2xl font-bold text-white">아돌펀드 분석</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 지갑 탭 */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setSelectedTab(tab.id);
                  setVisibleCount(20);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  selectedTab === tab.id
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 현재 자산 카드 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">
                {selectedTab === 'total' ? '종합 Total Assets' : `${selectedWallet?.name} Total Assets`}
              </p>
              <p className="text-2xl md:text-3xl font-bold text-emerald-400">
                {formatAssets(currentAssets)}
              </p>
              {/* 지갑 주소 (종합 제외) */}
              {selectedTab !== 'total' && selectedWallet && (
                <code className="text-xs text-slate-500 font-mono mt-1 block">
                  {selectedWallet.address.slice(0, 6)}...{selectedWallet.address.slice(-4)}
                </code>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {/* PumpSpace 이동 버튼 (종합 제외) */}
              {selectedTab !== 'total' && selectedWallet && (
                <a
                  href={`https://pumpspace.io/wallet/detail?account=${selectedWallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-all duration-200 text-sm font-medium"
                >
                  이동
                </a>
              )}
              {filteredHistory.length >= 2 && (
                <div className="text-right">
                  <p className="text-xs md:text-sm text-slate-400 mb-1">전일 대비</p>
                  {(() => {
                    const change = calculateChange(filteredHistory[0]?.total_assets, filteredHistory[1]?.total_assets);
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
          </div>
          
          {/* 종합 탭일 때 개별 지갑 현황 표시 */}
          {selectedTab === 'total' && currentAssetsData && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <p className="text-xs text-slate-400 mb-2">개별 지갑 현황</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {ADOL_WALLETS.map((wallet) => {
                  const key = Object.keys(currentAssetsData).find(
                    k => k.toLowerCase() === wallet.address.toLowerCase()
                  );
                  const assets = key ? currentAssetsData[key] : null;
                  return (
                    <div key={wallet.id} className="bg-slate-700/30 rounded-lg p-2">
                      <p className="text-xs text-slate-400">{wallet.name}</p>
                      <p className="text-sm font-medium text-white">{formatAssets(assets)}</p>
                    </div>
                  );
                })}
              </div>
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
        {isLoading ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
            <div className="flex items-center justify-center h-48 md:h-64">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          </Card>
        ) : chartData.length > 0 ? (
          <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">
              Total Assets 그래프
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
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
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
          <div className="p-3 md:p-4 border-b border-slate-700">
            <h2 className="text-base md:text-lg font-semibold text-white">Total Assets 테이블</h2>
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
                          <td className="px-4 py-4 text-sm md:text-base text-white">{item.recorded_at.replace(/^20/, '').replace(/-/g, '.')}</td>
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

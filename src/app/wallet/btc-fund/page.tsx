'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
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

const BTC_FUND_WALLET = '0x22BA71BB6C79cC15f3878f5dFbc262BBB28e7770';
const PUMPSPACE_URL = `https://pumpspace.io/wallet/detail?account=${BTC_FUND_WALLET}`;

const BTC_FUND_START_DATE = '2026-02-07';
const BTC_FUND_BTC_AMOUNT = 0.1474;
const BTC_FUND_BTC_PRICE = 68878;
const BTC_FUND_LOAN = 6700;
const BTC_FUND_LOAN_RATE = 0.055;

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

async function fetchBtcPrice(): Promise<number> {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
  const data = await res.json();
  return data.bitcoin?.usd || 0;
}

export default function BtcFundAnalysisPage() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    sessionStorage.setItem('lastTab', 'lab');
  }, []);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['wallet-history', BTC_FUND_WALLET],
    queryFn: () => fetchWalletHistory(BTC_FUND_WALLET),
  });

  const { data: currentAssets } = useQuery({
    queryKey: ['wallet-current', BTC_FUND_WALLET],
    queryFn: () => fetchCurrentAssets(BTC_FUND_WALLET),
  });

  const { data: btcPrice } = useQuery({
    queryKey: ['btc-price'],
    queryFn: fetchBtcPrice,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  const formatAssets = (assets: string | null) => assets ? assets.replace(/\.\d+/, '') : '-';
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

  // 경과일 계산
  const diffDays = useMemo(() => {
    const now = new Date();
    const koreaOffset = 9 * 60;
    const koreaTime = new Date(now.getTime() + (koreaOffset + now.getTimezoneOffset()) * 60000);
    const ty = koreaTime.getFullYear();
    const tm = koreaTime.getMonth() + 1;
    const td = koreaTime.getDate();
    const [sy, sm, sd] = BTC_FUND_START_DATE.split('-').map(Number);
    const todayDate = new Date(ty, tm - 1, td);
    const startDate = new Date(sy, sm - 1, sd);
    return Math.max(1, Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }, []);

  // BTC 관련 계산
  const btcCalc = useMemo(() => {
    const currentBtcPrice = btcPrice || 0;
    const collateralValue = BTC_FUND_BTC_AMOUNT * currentBtcPrice;
    const btcPnl = BTC_FUND_BTC_AMOUNT * (currentBtcPrice - BTC_FUND_BTC_PRICE);
    const loanInterest = BTC_FUND_LOAN * BTC_FUND_LOAN_RATE * (diffDays / 365);
    const ltv = collateralValue > 0 ? (BTC_FUND_LOAN / collateralValue) * 100 : 0;
    const fundValue = currentAssets ? parseAmount(currentAssets) : 0;
    const operatingProfit = fundValue > 0 ? fundValue - BTC_FUND_LOAN : 0;
    const netProfit = btcPnl + operatingProfit - loanInterest;

    return { currentBtcPrice, collateralValue, btcPnl, loanInterest, ltv, fundValue, operatingProfit, netProfit };
  }, [btcPrice, currentAssets, diffDays]);

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    switch (timeFrame) {
      case 'weekly':
        return history.filter((item) => new Date(item.recorded_at).getDay() === 1);
      case 'monthly':
        return history.filter((item) => new Date(item.recorded_at).getDate() === 1);
      default:
        return history.slice(0, 90);
    }
  }, [history, timeFrame]);

  const chartData = useMemo(() => {
    return [...filteredHistory].reverse().map((item) => {
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
    for (let tick = niceMin; tick <= niceMax; tick += niceStep) ticks.push(tick);
    return { domain: [niceMin, niceMax] as [number, number], ticks };
  }, [chartData]);

  const timeFrameLabel = { daily: '일간', weekly: '주간', monthly: '월간' };
  const formattedStartDate = BTC_FUND_START_DATE.replace(/^20/, '').replace(/-/g, '.');

  const formatPnl = (val: number) => {
    const sign = val >= 0 ? '+' : '';
    if (Math.abs(val) >= 1000) return `${sign}$${Math.round(val).toLocaleString()}`;
    return `${sign}$${val.toFixed(1)}`;
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
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <img src="/BTC.b.png" alt="BTC" className="w-8 h-8 rounded-full border-2 border-slate-700" />
                <h1 className="text-xl md:text-2xl font-bold text-white">BTC 펀드</h1>
              </div>
              <code className="text-xs md:text-sm text-slate-400 font-mono">
                {formatAddress(BTC_FUND_WALLET)}
              </code>
            </div>
            <a
              href={PUMPSPACE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <span>이동</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 펀드 요약 카드 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          {/* 순이익 */}
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700/50">
            <div>
              <p className="text-xs md:text-sm text-slate-400 mb-1">순이익</p>
              {btcCalc.currentBtcPrice > 0 && btcCalc.fundValue > 0 ? (
                <p className={`text-2xl md:text-3xl font-bold ${btcCalc.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPnl(btcCalc.netProfit)}
                </p>
              ) : (
                <p className="text-2xl md:text-3xl font-bold text-slate-500">-</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs md:text-sm text-slate-400 mb-1">개시일</p>
              <p className="text-sm md:text-base text-white">{formattedStartDate} ({diffDays}일 경과)</p>
            </div>
          </div>

          {/* 상세 정보 테이블 */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">BTC 담보</span>
              <span className="text-sm text-white">{BTC_FUND_BTC_AMOUNT} BTC</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">매입가</span>
              <span className="text-sm text-white">${BTC_FUND_BTC_PRICE.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">현재 BTC 가격</span>
              <span className="text-sm text-white">
                {btcCalc.currentBtcPrice > 0 ? `$${btcCalc.currentBtcPrice.toLocaleString()}` : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">담보 가치</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">
                  {btcCalc.currentBtcPrice > 0 ? `$${Math.round(btcCalc.collateralValue).toLocaleString()}` : '-'}
                </span>
                {btcCalc.currentBtcPrice > 0 && (
                  <span className={`text-sm font-medium ${btcCalc.btcPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ({formatPnl(btcCalc.btcPnl)})
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">대출금</span>
              <span className="text-sm text-white">${BTC_FUND_LOAN.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">대출 이율</span>
              <span className="text-sm text-white">{(BTC_FUND_LOAN_RATE * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">누적 이자</span>
              <span className="text-sm text-rose-400">-${btcCalc.loanInterest.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">LTV</span>
              <span className={`text-sm font-medium ${btcCalc.ltv > 78 ? 'text-rose-400' : 'text-amber-400'}`}>
                {btcCalc.currentBtcPrice > 0 ? `${btcCalc.ltv.toFixed(1)}%` : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-700/50">
              <span className="text-sm text-slate-400">운용 자산</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-white">{formatAssets(currentAssets)}</span>
                {btcCalc.fundValue > 0 && (
                  <span className={`text-sm font-medium ${btcCalc.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    (수익 {formatPnl(btcCalc.operatingProfit)})
                  </span>
                )}
              </div>
            </div>
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
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">운용 자산 그래프</h2>
            <div className="h-48 md:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
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
                      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                      if (value >= 10000) return `$${(value / 1000).toFixed(0)}K`;
                      return `$${Math.round(value).toLocaleString()}`;
                    }}
                    width={55}
                    domain={yAxisConfig.domain}
                    ticks={yAxisConfig.ticks}
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
                      if (payload && payload[0]) return payload[0].payload.fullDate;
                      return label;
                    }}
                    formatter={(value: number) => [`$${value.toLocaleString()}`, '운용 자산']}
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
            <h2 className="text-base md:text-lg font-semibold text-white">운용 자산 테이블</h2>
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
                      <th className="text-right text-sm md:text-base font-medium text-slate-400 px-4 py-3 md:py-4">운용 자산</th>
                      <th className="text-right text-sm md:text-base font-medium text-slate-400 px-4 py-3 md:py-4">현재 자산</th>
                      <th className="text-right text-sm md:text-base font-medium text-slate-400 px-4 py-3 md:py-4">변동</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, visibleCount).map((item, index) => {
                      const prevItem = filteredHistory[index + 1];
                      const change = calculateChange(item.total_assets, prevItem?.total_assets);
                      const isPositive = change !== null && change >= 0;

                      // 현재 자산 계산 (원금 + BTC손익 + 운용수익 - 대출이자)
                      const operatingVal = parseAmount(item.total_assets);
                      const rowBtcPnl = btcCalc.currentBtcPrice > 0 ? BTC_FUND_BTC_AMOUNT * (btcCalc.currentBtcPrice - BTC_FUND_BTC_PRICE) : 0;
                      const rowOperatingProfit = operatingVal > 0 ? operatingVal - BTC_FUND_LOAN : 0;

                      // 해당 날짜 기준 경과일 계산
                      const [ry, rm, rd] = item.recorded_at.split('-').map(Number);
                      const [sy2, sm2, sd2] = BTC_FUND_START_DATE.split('-').map(Number);
                      const rowDate = new Date(ry, rm - 1, rd);
                      const startDate2 = new Date(sy2, sm2 - 1, sd2);
                      const rowDiffDays = Math.max(1, Math.floor((rowDate.getTime() - startDate2.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                      const rowLoanInterest = BTC_FUND_LOAN * BTC_FUND_LOAN_RATE * (rowDiffDays / 365);

                      const rowCurrentAsset = btcCalc.currentBtcPrice > 0 && operatingVal > 0
                        ? 10058 + rowBtcPnl + rowOperatingProfit - rowLoanInterest
                        : 0;

                      return (
                        <tr key={item.recorded_at} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                          <td className="px-4 py-4 text-sm md:text-base text-white">{item.recorded_at.replace(/^20/, '').replace(/-/g, '.')}</td>
                          <td className="px-4 py-4 text-right text-sm md:text-base text-emerald-400 font-mono">
                            {formatAssets(item.total_assets)}
                          </td>
                          <td className={`px-4 py-4 text-right text-sm md:text-base font-mono ${rowCurrentAsset >= 10058 ? 'text-emerald-400' : rowCurrentAsset > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                            {rowCurrentAsset > 0 ? `$${Math.round(rowCurrentAsset).toLocaleString()}` : '-'}
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
              <p className="text-sm mt-1">매 시간 데이터가 저장됩니다</p>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}

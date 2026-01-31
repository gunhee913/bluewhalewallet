'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
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

// 더미 데이터 생성 (365일치) - 시드 기반 고정 데이터
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateDummyHistory(days: number) {
  const history = [];
  const endDate = new Date('2026-01-31');
  let baseAmount = 1240526;

  for (let i = 0; i < days; i++) {
    const date = new Date(endDate);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    const dayOfMonth = date.getDate();

    history.push({
      recorded_at: dateStr,
      total_assets: `$${Math.round(baseAmount).toLocaleString()}`,
      dayOfWeek,
      dayOfMonth,
    });

    const randomChange = (seededRandom(i + 1) - 0.4) * 0.03;
    baseAmount = baseAmount / (1 + randomChange) / (i === 0 ? 1 : 1.002);
  }

  return history;
}

const DUMMY_HISTORY = generateDummyHistory(365);

const CURRENT_ASSETS = '$1,240,526';
const WALLET_NAME = '바이백펀드 (테스트)';

type TimeFrame = 'daily' | 'weekly' | 'monthly';

export default function TestWalletPage() {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('daily');

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
    switch (timeFrame) {
      case 'weekly':
        return DUMMY_HISTORY.filter((item) => item.dayOfWeek === 1);
      case 'monthly':
        return DUMMY_HISTORY.filter((item) => item.dayOfMonth === 1);
      default:
        return DUMMY_HISTORY.slice(0, 90);
    }
  }, [timeFrame]);

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
    if (timeFrame === 'daily') return Math.floor(chartData.length / 6);
    if (timeFrame === 'weekly') return 3;
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
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">돌아가기</span>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">{WALLET_NAME}</h1>
            <code className="text-xs md:text-sm text-slate-400 font-mono">
              {formatAddress('0x3654378aa2deb0860c2e5c7906471c8704c44c6f')}
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
                {formatAssets(CURRENT_ASSETS)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs md:text-sm text-slate-400 mb-1">어제 대비</p>
              {(() => {
                const change = calculateChange(CURRENT_ASSETS, DUMMY_HISTORY[1]?.total_assets);
                if (change === null) return <p className="text-slate-500">-</p>;
                const isPositive = change >= 0;
                return (
                  <span className={`text-lg md:text-xl font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPositive ? '+' : ''}{change.toFixed(2)}%
                  </span>
                );
              })()}
            </div>
          </div>
        </Card>

        {/* 시간 프레임 탭 */}
        <div className="flex gap-2 mb-4 md:mb-6">
          {(['daily', 'weekly', 'monthly'] as TimeFrame[]).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeFrame(tf)}
              className={`flex-1 md:flex-none px-3 md:px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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
        <Card className="bg-slate-800/50 border-slate-700/50 p-4 md:p-6 mb-6">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <h2 className="text-base md:text-lg font-semibold text-white">Total Assets 그래프</h2>
            <span className="text-xs md:text-sm text-slate-400">
              {timeFrame === 'daily' && '매일 자정'}
              {timeFrame === 'weekly' && '매주 월요일'}
              {timeFrame === 'monthly' && '매월 1일'}
            </span>
          </div>
          <div className="h-48 md:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
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
                  dot={timeFrame !== 'daily' ? { fill: '#34d399', strokeWidth: 2, r: 3 } : false}
                  activeDot={{ r: 5, fill: '#34d399' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* 히스토리 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold text-white">Total Assets 테이블</h2>
            <span className="text-xs md:text-sm text-slate-400">{filteredHistory.length}개</span>
          </div>
          
          <div className="overflow-x-auto max-h-80 md:max-h-96 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
            <table className="w-full">
              <thead className="bg-slate-800 sticky top-0">
                <tr>
                  <th className="text-left text-xs md:text-sm font-medium text-slate-400 px-3 md:px-4 py-2 md:py-3">날짜</th>
                  <th className="text-right text-xs md:text-sm font-medium text-slate-400 px-3 md:px-4 py-2 md:py-3">Total Assets</th>
                  <th className="text-right text-xs md:text-sm font-medium text-slate-400 px-3 md:px-4 py-2 md:py-3">변동</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((item, index) => {
                  const prevItem = filteredHistory[index + 1];
                  const change = calculateChange(item.total_assets, prevItem?.total_assets);
                  const isPositive = change !== null && change >= 0;
                  
                  return (
                    <tr key={item.recorded_at} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                      <td className="px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm text-white">{item.recorded_at}</td>
                      <td className="px-3 md:px-4 py-2.5 md:py-3 text-right text-xs md:text-sm text-emerald-400 font-mono">
                        {formatAssets(item.total_assets)}
                      </td>
                      <td className={`px-3 md:px-4 py-2.5 md:py-3 text-right text-xs md:text-sm font-medium ${
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
        </Card>
      </main>
    </div>
  );
}

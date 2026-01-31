'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';

// 지갑 이름 매핑
const WALLET_NAMES: Record<string, string> = {
  '0x3654378aa2deb0860c2e5c7906471c8704c44c6f': '바이백펀드',
  '0xed1b254b6c3a6785e19ba83b728ece4a6444f4d7': '아돌펀드',
  '0xd57423c54f188220862391a069a2942c725ee37b': 'Aqua1 펀드',
  '0xfd48a5ffe5127896e93baa8074ce98c5a999ea97': 'v3 수수료 펀드(40%)',
};

interface HistoryItem {
  recorded_at: string;
  total_assets: string;
}

async function fetchWalletHistory(address: string): Promise<HistoryItem[]> {
  const response = await fetch(`/api/wallet/history?address=${address}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>돌아가기</span>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{walletName}</h1>
            <code className="text-sm text-slate-400 font-mono">{formatAddress(address)}</code>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* 현재 자산 카드 */}
        <Card className="bg-slate-800/50 border-slate-700/50 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400 mb-1">현재 Total Assets</p>
              <p className="text-3xl font-bold text-emerald-400">
                {formatAssets(currentAssets)}
              </p>
            </div>
            {history && history.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-slate-400 mb-1">어제 대비</p>
                {(() => {
                  const change = calculateChange(currentAssets, history[0]?.total_assets);
                  if (change === null) return <p className="text-slate-500">-</p>;
                  const isPositive = change >= 0;
                  return (
                    <div className={`flex items-center gap-1 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isPositive ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      <span className="text-xl font-bold">{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </Card>

        {/* 히스토리 테이블 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">자산 변화 기록</h2>
          </div>
          
          {historyLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : history && history.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="text-left text-sm font-medium text-slate-400 px-4 py-3">날짜</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-4 py-3">Total Assets</th>
                    <th className="text-right text-sm font-medium text-slate-400 px-4 py-3">변동</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, index) => {
                    const prevItem = history[index + 1];
                    const change = calculateChange(item.total_assets, prevItem?.total_assets);
                    const isPositive = change !== null && change >= 0;
                    
                    return (
                      <tr key={item.recorded_at} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                        <td className="px-4 py-3 text-white">{item.recorded_at}</td>
                        <td className="px-4 py-3 text-right text-emerald-400 font-mono">
                          {formatAssets(item.total_assets)}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${
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

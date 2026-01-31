'use client';

import { Card } from '@/components/ui/card';
import { Wallet, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';

const PUMPSPACE_BASE_URL = 'https://pumpspace.io/wallet/detail?account=';

type Chain = 'avalanche' | 'kaia';

interface WalletInfo {
  name: string;
  address: string;
  chain: Chain;
  hasAnalysis?: boolean;
}

const WALLETS: WalletInfo[] = [
  {
    name: '바이백펀드',
    address: '0x3654378aa2deb0860c2e5c7906471c8704c44c6f',
    chain: 'avalanche',
    hasAnalysis: true,
  },
  {
    name: '아돌펀드',
    address: '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7',
    chain: 'avalanche',
    hasAnalysis: true,
  },
  {
    name: 'Aqua1 펀드',
    address: '0xD57423c54F188220862391A069a2942c725ee37B',
    chain: 'avalanche',
    hasAnalysis: true,
  },
  {
    name: '팀 지갑',
    address: '0x525e7f0a5d3fd6169d6ec35288104d52bf3bb95f',
    chain: 'avalanche',
    hasAnalysis: true,
  },
  {
    name: 'v3 수수료 펀드(40%)',
    address: '0xfd48a5FFE5127896E93BAA8074CE98c5a999Ea97',
    chain: 'avalanche',
    hasAnalysis: true,
  },
  {
    name: '소각 지갑',
    address: '0x000000000000000000000000000000000000dEaD',
    chain: 'avalanche',
  },
];

const CHAIN_CONFIG = {
  avalanche: {
    name: 'Avalanche',
  },
  kaia: {
    name: 'Kaia',
  },
};

// Supabase에서 캐시된 데이터 가져오기
async function fetchCachedData(addresses: string[]) {
  const response = await fetch(`/api/wallet?addresses=${addresses.join(',')}`);
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

interface WalletCardProps {
  wallet: WalletInfo;
  totalAssets: string | null;
}

function WalletCard({ wallet, totalAssets }: WalletCardProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatAssets = (assets: string) => {
    // 소수점 제거: "$1,234.56" -> "$1,234"
    return assets.replace(/\.\d+/, '');
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 transition-all duration-200 overflow-hidden group">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white mb-1">{wallet.name}</h2>
            <code className="text-sm text-slate-400 font-mono mb-2 block">
              {formatAddress(wallet.address)}
            </code>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Total Assets:</span>
              {totalAssets ? (
                <span className="text-lg font-bold text-emerald-400">{formatAssets(totalAssets)}</span>
              ) : (
                <span className="text-sm text-slate-500">-</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href={`${PUMPSPACE_BASE_URL}${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-all duration-200 font-medium text-center"
            >
              이동
            </a>
            {wallet.hasAnalysis && (
              <Link
                href={`/wallet/${wallet.address}`}
                className="px-6 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-all duration-200 font-medium text-center"
              >
                분석
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<Chain>('avalanche');

  const filteredWallets = useMemo(
    () => WALLETS.filter((wallet) => wallet.chain === selectedChain),
    [selectedChain]
  );

  const addresses = useMemo(
    () => filteredWallets.map((w) => w.address),
    [filteredWallets]
  );

  // 캐시된 데이터 로드 (30분마다 자동 업데이트됨)
  const { data, isLoading } = useQuery({
    queryKey: ['wallets', selectedChain],
    queryFn: () => fetchCachedData(addresses),
    staleTime: 30 * 60 * 1000, // 30분
    refetchInterval: 30 * 60 * 1000, // 30분마다 리페치
    enabled: addresses.length > 0,
  });

  const getAssets = (address: string): string | null => {
    if (!data?.results) return null;
    const key = Object.keys(data.results).find(
      (k) => k.toLowerCase() === address.toLowerCase()
    );
    return key ? data.results[key] : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              BlueWhale Wallet
            </h1>
            <p className="text-sm text-slate-400">블루웨일 지갑 주소 한눈에 보기(Made.축산왕)</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Chain 선택 탭 */}
        <div className="flex items-center justify-between mb-6 border-b border-slate-700">
          <div className="flex gap-6">
            <button
              onClick={() => setSelectedChain('avalanche')}
              className={`pb-3 text-sm font-medium transition-colors ${
                selectedChain === 'avalanche'
                  ? 'text-white border-b-2 border-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Avalanche
            </button>
            <button
              onClick={() => setSelectedChain('kaia')}
              className={`pb-3 text-sm font-medium transition-colors ${
                selectedChain === 'kaia'
                  ? 'text-white border-b-2 border-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Kaia
            </button>
          </div>
        </div>

        {/* 로딩 */}
        {isLoading && (
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">로딩 중...</span>
          </div>
        )}

        {/* 지갑 목록 */}
        <div className="space-y-4">
          {filteredWallets.map((wallet) => (
            <WalletCard
              key={wallet.address}
              wallet={wallet}
              totalAssets={getAssets(wallet.address)}
            />
          ))}
        </div>

        {/* Empty State */}
        {filteredWallets.length === 0 && (
          <div className="text-center py-20">
            <Wallet className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {CHAIN_CONFIG[selectedChain].name}에 등록된 지갑이 없습니다
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <p className="text-center text-sm text-slate-500">
            Powered by{' '}
            <a
              href="https://pumpspace.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:underline"
            >
              PumpSpace.io
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

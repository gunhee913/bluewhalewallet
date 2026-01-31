'use client';

import { Card } from '@/components/ui/card';
import { ExternalLink, Copy, Wallet, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

const PUMPSPACE_BASE_URL = 'https://pumpspace.io/wallet/detail?account=';

type Chain = 'avalanche' | 'kaia';

interface WalletInfo {
  name: string;
  address: string;
  chain: Chain;
}

const WALLETS: WalletInfo[] = [
  {
    name: '바이백펀드',
    address: '0x3654378aa2deb0860c2e5c7906471c8704c44c6f',
    chain: 'avalanche',
  },
  {
    name: '아돌펀드',
    address: '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7',
    chain: 'avalanche',
  },
  {
    name: 'Aqua1 펀드',
    address: '0xD57423c54F188220862391A069a2942c725ee37B',
    chain: 'avalanche',
  },
  {
    name: 'v3 수수료 펀드(40%)',
    address: '0xfd48a5FFE5127896E93BAA8074CE98c5a999Ea97',
    chain: 'avalanche',
  },
  {
    name: 'v3 수수료 소각(60%)',
    address: '0x000000000000000000000000000000000000dEaD',
    chain: 'avalanche',
  },
];

const CHAIN_CONFIG = {
  avalanche: {
    name: 'Avalanche',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    activeColor: 'bg-red-500 text-white',
  },
  kaia: {
    name: 'Kaia',
    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    activeColor: 'bg-emerald-500 text-white',
  },
};

async function fetchWalletData(address: string) {
  const response = await fetch(`/api/wallet?address=${address}`);
  if (!response.ok) {
    throw new Error('Failed to fetch wallet data');
  }
  return response.json();
}

function WalletCard({ wallet }: { wallet: WalletInfo }) {
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['wallet', wallet.address],
    queryFn: () => fetchWalletData(wallet.address),
    staleTime: 1000 * 60 * 5,
  });

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      description: '지갑 주소가 복사되었습니다',
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 transition-all duration-200 overflow-hidden group">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-white">{wallet.name}</h2>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <code className="text-sm text-emerald-400 font-mono">
                {formatAddress(wallet.address)}
              </code>
              <button
                onClick={() => handleCopyAddress(wallet.address)}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                title="주소 복사"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Total Assets:</span>
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              ) : error ? (
                <span className="text-sm text-red-400">불러오기 실패</span>
              ) : data?.totalAssets ? (
                <span className="text-lg font-bold text-emerald-400">
                  {data.totalAssets}
                </span>
              ) : (
                <span className="text-sm text-slate-500">-</span>
              )}
            </div>
          </div>

          <a
            href={`${PUMPSPACE_BASE_URL}${wallet.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-all duration-200 group-hover:scale-105"
          >
            <span className="text-sm font-medium">PumpSpace</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </Card>
  );
}

export default function Home() {
  const [selectedChain, setSelectedChain] = useState<Chain>('avalanche');

  const filteredWallets = WALLETS.filter(
    (wallet) => wallet.chain === selectedChain
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Wallet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">
                BlueWhale Wallet
              </h1>
              <p className="text-sm text-slate-400">블루웨일 지갑 주소 한눈에 보기</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* Chain 선택 탭 */}
        <div className="flex gap-6 mb-6 border-b border-slate-700">
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

        {/* 지갑 목록 */}
        <div className="space-y-4">
          {filteredWallets.map((wallet) => (
            <WalletCard key={wallet.address} wallet={wallet} />
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

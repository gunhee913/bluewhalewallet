'use client';

import { Card } from '@/components/ui/card';
import { Loader2, Flame } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const PUMPSPACE_BASE_URL = 'https://pumpspace.io/wallet/detail?account=';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

interface WalletInfo {
  name: string;
  address: string;
  hasAnalysis?: boolean;
}

const WALLETS: WalletInfo[] = [
  {
    name: '바이백펀드',
    address: '0x3654378aa2deb0860c2e5c7906471c8704c44c6f',
    hasAnalysis: true,
  },
  {
    name: '아돌펀드',
    address: '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7',
    hasAnalysis: true,
  },
  {
    name: 'Aqua1 펀드',
    address: '0xD57423c54F188220862391A069a2942c725ee37B',
    hasAnalysis: true,
  },
  {
    name: '팀 지갑',
    address: '0x525e7f0a5d3fd6169d6ec35288104d52bf3bb95f',
    hasAnalysis: true,
  },
  {
    name: 'v3 수수료 펀드(40%)',
    address: '0xfd48a5FFE5127896E93BAA8074CE98c5a999Ea97',
    hasAnalysis: true,
  },
  {
    name: '소각 지갑',
    address: '0x000000000000000000000000000000000000dEaD',
  },
];

// Supabase에서 캐시된 데이터 가져오기
async function fetchCachedData(addresses: string[]) {
  const response = await fetch(`/api/wallet?addresses=${addresses.join(',')}`);
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

// 토큰 소각 데이터 가져오기
async function fetchTokenBurnData() {
  const response = await fetch('/api/token/burn');
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

// 토큰 목록 (총 발행량 포함)
const TOKENS = [
  { name: 'sBWPM', totalSupply: 7000 },
  { name: 'sADOL', totalSupply: 70000 },
  { name: 'AQUA1', totalSupply: 0 },
  { name: 'CLAM', totalSupply: 70000000 },
  { name: 'PEARL', totalSupply: 0 },
  { name: 'SHELL', totalSupply: 0 },
  { name: 'CORAL', totalSupply: 0 },
];

interface TokenBurnData {
  burned_amount: number;
  burned_value: string;
}

interface TokenCardProps {
  name: string;
  totalSupply: number;
  burnData?: TokenBurnData;
}

// 토큰 이미지 매핑
const TOKEN_IMAGES: Record<string, string> = {
  'sBWPM': '/sBWPM.svg',
  'sADOL': '/sADOL.svg',
  'CLAM': '/CLAM.svg',
  'PEARL': '/PEARL.svg',
  'SHELL': '/SHELL.svg',
  'CORAL': '/CORAL.png',
  'AQUA1': '/AQUA1.svg',
};

function TokenCard({ name, totalSupply, burnData }: TokenCardProps) {
  const burnedAmount = burnData?.burned_amount || 0;
  const remaining = totalSupply > 0 ? totalSupply - burnedAmount : 0;
  const burnRate = totalSupply > 0 ? (burnedAmount / totalSupply) * 100 : 0;

  const formatNumber = (num: number, withDecimal: boolean = false) => {
    return num.toLocaleString(undefined, { maximumFractionDigits: withDecimal ? 1 : 0 });
  };
  
  // sBWPM, sADOL만 소수점 표시
  const showDecimal = name === 'sBWPM' || name === 'sADOL';

  const formatValue = (value?: string) => {
    if (!value || value === '$0') return '-';
    return value.replace(/\.\d+/, '');
  };

  const tokenImage = TOKEN_IMAGES[name];

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 transition-all duration-200 overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {tokenImage ? (
              <img src={tokenImage} alt={name} className="w-8 h-8 rounded-full" />
            ) : (
              <Flame className="w-5 h-5 text-orange-400" />
            )}
            <h2 className="text-lg font-semibold text-white">{name}</h2>
          </div>
          <Link
            href={`/token/${name}`}
            className="px-4 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-all duration-200 text-sm font-medium"
          >
            분석
          </Link>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">총 발행량</span>
            <span className="text-sm font-medium text-white">{formatNumber(totalSupply, showDecimal)} 개</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">소각량</span>
            <span className="text-sm font-medium text-orange-400">
              {burnedAmount > 0 ? `${formatNumber(burnedAmount, showDecimal)} 개` : '-'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">소각 금액</span>
            <span className="text-sm font-medium text-emerald-400">{formatValue(burnData?.burned_value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">남은 개수</span>
            <span className="text-sm font-medium text-white">
              {burnedAmount > 0 ? `${formatNumber(remaining, showDecimal)} 개` : '-'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-400">소각률</span>
            <span className="text-sm font-medium text-white">
              {burnedAmount > 0 ? `${burnRate.toFixed(2)}%` : '-'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
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

function HomeContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [selectedTab, setSelectedTab] = useState<'wallet' | 'token'>('wallet');

  // URL 파라미터로 탭 설정
  useEffect(() => {
    if (tabParam === 'token') {
      setSelectedTab('token');
    }
  }, [tabParam]);

  const addresses = useMemo(
    () => WALLETS.map((w) => w.address),
    []
  );

  // 지갑 데이터 로드 (푸터에 lastUpdated 필요하므로 항상 로드)
  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => fetchCachedData(addresses),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  // 토큰 소각 데이터 로드
  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ['token-burn'],
    queryFn: fetchTokenBurnData,
    staleTime: 60 * 60 * 1000, // 1시간 (자정에만 업데이트)
    enabled: selectedTab === 'token',
  });

  const getAssets = (address: string): string | null => {
    if (!walletData?.results) return null;
    const key = Object.keys(walletData.results).find(
      (k) => k.toLowerCase() === address.toLowerCase()
    );
    return key ? walletData.results[key] : null;
  };

  const isLoading = selectedTab === 'wallet' ? walletLoading : tokenLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              BlueWhale Analytics
            </h1>
            <p className="text-sm text-slate-400">블루웨일 생태계 분석 한눈에 보기(Made.축산왕)</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        {/* 탭 선택 */}
        <div className="flex items-center justify-between mb-6 border-b border-slate-700">
          <div className="flex gap-6">
            <button
              onClick={() => setSelectedTab('wallet')}
              className={`pb-3 text-sm font-medium transition-colors ${
                selectedTab === 'wallet'
                  ? 'text-white border-b-2 border-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              지갑
            </button>
            <button
              onClick={() => setSelectedTab('token')}
              className={`pb-3 text-sm font-medium transition-colors ${
                selectedTab === 'token'
                  ? 'text-white border-b-2 border-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              토큰
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

        {/* Wallet 탭 */}
        {selectedTab === 'wallet' && (
          <div className="space-y-4">
            {WALLETS.map((wallet) => (
              <WalletCard
                key={wallet.address}
                wallet={wallet}
                totalAssets={getAssets(wallet.address)}
              />
            ))}
          </div>
        )}

        {/* Token 탭 - 소각 현황 */}
        {selectedTab === 'token' && (
          <div className="space-y-4">
            {TOKENS.map((token) => {
              const burnData = tokenData?.tokens?.find(
                (t: { token_name: string }) => t.token_name === token.name
              );
              return (
                <TokenCard
                  key={token.name}
                  name={token.name}
                  totalSupply={token.totalSupply}
                  burnData={burnData}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <p className="text-center text-sm text-slate-500 flex flex-wrap items-center justify-center gap-x-2">
            <span>
              Powered by{' '}
              <a
                href="https://pumpspace.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                PumpSpace.io
              </a>
            </span>
            {walletData?.lastUpdated && (
              <span className="text-slate-600">
                | 최근 업데이트: {new Date(walletData.lastUpdated).toLocaleString('ko-KR', { 
                  month: 'short', 
                  day: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}

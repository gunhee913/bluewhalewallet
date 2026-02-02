'use client';

import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Flame } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const PUMPSPACE_BASE_URL = 'https://pumpspace.io/wallet/detail?account=';
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

// 바이백펀드 메인 지갑
const BUYBACK_MAIN = '0x3654378aa2deb0860c2e5c7906471c8704c44c6f';

// 바이백펀드 AI 지갑들
const BUYBACK_AI_WALLETS = [
  '0xDf3723f75a8B3E10Fe0093991C961d58A5549fDE', // AI(1)
  '0x8c29527976b07F6e9c5Fa7705a4997C3B9e7fdD4', // AI(2)
  '0xF7E18a70C31C5E8D89e00a5a5e81Fc44E607513B', // AI(3)
  '0x7c6d9059792C711229Ca7295eaa8916cF2a33776', // AI(4)
  '0x61CA700c0b004029Fc4A80C409C9829ABe79528D', // AI(5)
  '0xa617A017A09CFEc5d22598e92C252dfBF327fF91', // AI(6)
  '0x981086C666D3EB8A11f122B001B58346A6422B80', // AI(7)
  '0x5DEf16B5E663baEb75C44B30c273281aFD5Fd342', // AI(8)
];

// 아돌펀드 메인 지갑
const ADOL_MAIN = '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7';

// 아돌펀드 AI 지갑들
const ADOL_AI_WALLETS = [
  '0xe2E6252aBf18680169f8e95aa8f2b5c5E6c05390', // AI(1)
  '0x8E63231be79fFDFECf46b13FFDE1881fD9C7e231', // AI(2)
  '0x9Bd2c37535F41cE4FC373cAcee1F7Bd023DC5b9A', // AI(3)
  '0xC81A059E9A2185A97925d6B7b5D527294c439625', // AI(4)
];

// 실험실 - bUSDC 지갑
const BUSDC_WALLET = '0x6A3a608213a6597aaC0d7BC08da8e7f77d6FaEdB';

interface WalletInfo {
  name: string;
  address: string;
  hasAnalysis?: boolean;
  isBuybackTotal?: boolean; // 바이백펀드 종합 표시용
  isAdolTotal?: boolean; // 아돌펀드 종합 표시용
}

const WALLETS: WalletInfo[] = [
  {
    name: '바이백펀드',
    address: '0x3654378aa2deb0860c2e5c7906471c8704c44c6f',
    hasAnalysis: true,
    isBuybackTotal: true,
  },
  {
    name: '아돌펀드',
    address: '0xEd1b254B6c3a6785e19ba83b728ECe4A6444f4d7',
    hasAnalysis: true,
    isAdolTotal: true,
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
    name: 'v3 수수료 펀드(60%)',
    address: '0x52FB7d3ab53d5a8d348B15ea7E3f7bfE35dD35F1',
    hasAnalysis: true,
  },
  {
    name: 'v2 수수료 펀드',
    address: '0x021f53A57F99413A83298187C139f647F95F5133',
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

// 토큰 목록 (순서만 정의, 총 발행량은 API에서 가져옴)
const TOKEN_NAMES = ['sBWPM', 'sADOL', 'AQUA1', 'CLAM', 'PEARL', 'SHELL', 'CORAL'];

interface TokenBurnData {
  burned_amount: number;
  burned_value: string;
  total_supply: number;
  token_price?: number;
}

interface TokenCardProps {
  name: string;
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

function TokenCard({ name, burnData }: TokenCardProps) {
  const burnedAmount = burnData?.burned_amount || 0;
  const totalSupply = burnData?.total_supply || 0;
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
            {burnData?.token_price && burnData.token_price > 0 && (
              <span className="text-sm text-slate-400">
                ${name === 'sBWPM' 
                  ? burnData.token_price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                  : name === 'sADOL'
                    ? burnData.token_price.toFixed(1) 
                    : burnData.token_price.toFixed(4)}
              </span>
            )}
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
            <span className="text-sm text-slate-400">총소각가치</span>
            <span className="text-sm font-medium text-emerald-400">{formatValue(burnData?.burned_value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">유통량</span>
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

interface BuybackDetails {
  main: string | null;
  ai: string | null;
}

interface AquaFairPriceData {
  fairPrice: number;
  blueWhaleByback: number;
  totalSupply: number;
  burnedAmount: number;
  circulation: number;
  currentValue: number;
}

interface WalletCardProps {
  wallet: WalletInfo;
  totalAssets: string | null;
  fundDetails?: BuybackDetails; // 바이백/아돌 펀드 메인/AI 분리 표시용
  aquaFairPrice?: AquaFairPriceData; // 아쿠아1 펀드 적정가격
}

function WalletCard({ wallet, totalAssets, fundDetails, aquaFairPrice }: WalletCardProps) {
  const formatAssets = (assets: string) => {
    // 소수점 제거: "$1,234.56" -> "$1,234"
    return assets.replace(/\.\d+/, '');
  };

  // 분석 페이지 링크 결정
  const getAnalysisLink = () => {
    if (wallet.isBuybackTotal) return '/wallet/buyback';
    if (wallet.isAdolTotal) return '/wallet/adol';
    return `/wallet/${wallet.address}`;
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 transition-all duration-200 overflow-hidden group">
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white mb-2">{wallet.name}</h2>

            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">Total Assets:</span>
              {totalAssets ? (
                <span className="text-lg font-bold text-emerald-400">{formatAssets(totalAssets)}</span>
              ) : (
                <span className="text-sm text-slate-500">-</span>
              )}
            </div>
            
            {/* 펀드 요약 (바이백/아돌) */}
            {fundDetails && (
              <div className="mt-2 text-sm text-slate-400">
                메인 {fundDetails.main ? formatAssets(fundDetails.main) : '-'} | AI {fundDetails.ai ? formatAssets(fundDetails.ai) : '-'}
              </div>
            )}
            
            {/* 아쿠아1 적정가격 */}
            {aquaFairPrice && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">적정가격:</span>
                  <span className="text-sm text-slate-400">
                    {aquaFairPrice.fairPrice.toFixed(2)} USDT
                  </span>
                  <span className="text-sm text-slate-400">
                    ({(aquaFairPrice.fairPrice - 1) >= 0 ? '+' : ''}{((aquaFairPrice.fairPrice - 1) * 100).toFixed(1)}%)
                  </span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="w-5 h-5 rounded-full bg-slate-600 hover:bg-slate-500 text-xs text-white flex items-center justify-center transition-colors">
                        ?
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 bg-slate-800 border-slate-700 text-slate-300 p-4">
                      <div className="space-y-2 text-xs">
                        <p className="text-slate-400 font-medium text-sm mb-3">산출 방식</p>
                        <p>sBWPM바이백 = (총발행량 + 소각량) × 3%</p>
                        <p className="text-slate-400">= ({Math.round(aquaFairPrice.totalSupply).toLocaleString()} + {Math.round(aquaFairPrice.burnedAmount).toLocaleString()}) × 3% = {Math.round(aquaFairPrice.blueWhaleByback).toLocaleString()}개</p>
                        <p className="mt-3">적정가격 = (현재 펀드자산 - sBWPM바이백) / Aqua1 유통량</p>
                        <p className="text-slate-400">= ({Math.round(aquaFairPrice.currentValue).toLocaleString()} - {Math.round(aquaFairPrice.blueWhaleByback).toLocaleString()}) / {Math.round(aquaFairPrice.circulation).toLocaleString()}</p>
                        <p className="text-slate-300 font-medium mt-2">= {aquaFairPrice.fairPrice.toFixed(2)} USDT</p>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
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
                href={getAnalysisLink()}
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
  const [selectedTab, setSelectedTab] = useState<'wallet' | 'token' | 'lab'>('wallet');

  // 페이지 로드 시 sessionStorage에서 탭 상태 복원
  useEffect(() => {
    // URL 파라미터가 있으면 우선
    if (tabParam === 'token') {
      setSelectedTab('token');
      return;
    }
    if (tabParam === 'lab') {
      setSelectedTab('lab');
      return;
    }
    
    // sessionStorage에서 마지막 탭 상태 복원
    const savedTab = sessionStorage.getItem('lastTab');
    if (savedTab === 'token' || savedTab === 'wallet' || savedTab === 'lab') {
      setSelectedTab(savedTab);
    }
  }, [tabParam]);

  // 탭 변경 핸들러
  const handleTabChange = (tab: 'wallet' | 'token' | 'lab') => {
    setSelectedTab(tab);
    sessionStorage.setItem('lastTab', tab);
  };

  const addresses = useMemo(
    () => [...WALLETS.map((w) => w.address), ...BUYBACK_AI_WALLETS, ...ADOL_AI_WALLETS, BUSDC_WALLET],
    []
  );

  // 지갑 데이터 로드 (푸터에 lastUpdated 필요하므로 항상 로드)
  const { data: walletData, isLoading: walletLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: () => fetchCachedData(addresses),
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  // 토큰 소각 데이터 로드 (아쿠아1 적정가격 계산에도 필요)
  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ['token-burn'],
    queryFn: fetchTokenBurnData,
    staleTime: 60 * 60 * 1000, // 1시간
  });

  const parseAmount = (assets: string | null): number => {
    if (!assets) return 0;
    return parseFloat(assets.replace(/[$,]/g, '')) || 0;
  };

  const getAssets = (address: string, isBuybackTotal?: boolean, isAdolTotal?: boolean): string | null => {
    if (!walletData?.results) return null;
    
    // 바이백펀드 종합인 경우 메인 + AI 지갑 합계
    if (isBuybackTotal) {
      const allBuybackAddresses = [BUYBACK_MAIN, ...BUYBACK_AI_WALLETS];
      let total = 0;
      for (const addr of allBuybackAddresses) {
        const key = Object.keys(walletData.results).find(
          (k) => k.toLowerCase() === addr.toLowerCase()
        );
        if (key && walletData.results[key]) {
          total += parseAmount(walletData.results[key]);
        }
      }
      return total > 0 ? `$${total.toLocaleString()}` : null;
    }
    
    // 아돌펀드 종합인 경우 메인 + AI 지갑 합계
    if (isAdolTotal) {
      const allAdolAddresses = [ADOL_MAIN, ...ADOL_AI_WALLETS];
      let total = 0;
      for (const addr of allAdolAddresses) {
        const key = Object.keys(walletData.results).find(
          (k) => k.toLowerCase() === addr.toLowerCase()
        );
        if (key && walletData.results[key]) {
          total += parseAmount(walletData.results[key]);
        }
      }
      return total > 0 ? `$${total.toLocaleString()}` : null;
    }
    
    const key = Object.keys(walletData.results).find(
      (k) => k.toLowerCase() === address.toLowerCase()
    );
    return key ? walletData.results[key] : null;
  };

  // 바이백펀드 메인/AI 금액 계산
  const getBuybackDetails = (): BuybackDetails | undefined => {
    if (!walletData?.results) return undefined;
    
    // 메인 금액
    const mainKey = Object.keys(walletData.results).find(
      (k) => k.toLowerCase() === BUYBACK_MAIN.toLowerCase()
    );
    const mainAmount = mainKey ? walletData.results[mainKey] : null;
    
    // AI 합계
    let aiTotal = 0;
    for (const addr of BUYBACK_AI_WALLETS) {
      const key = Object.keys(walletData.results).find(
        (k) => k.toLowerCase() === addr.toLowerCase()
      );
      if (key && walletData.results[key]) {
        aiTotal += parseAmount(walletData.results[key]);
      }
    }
    const aiAmount = aiTotal > 0 ? `$${aiTotal.toLocaleString()}` : null;
    
    return { main: mainAmount, ai: aiAmount };
  };

  // 아돌펀드 메인/AI 금액 계산
  const getAdolDetails = (): BuybackDetails | undefined => {
    if (!walletData?.results) return undefined;
    
    // 메인 금액
    const mainKey = Object.keys(walletData.results).find(
      (k) => k.toLowerCase() === ADOL_MAIN.toLowerCase()
    );
    const mainAmount = mainKey ? walletData.results[mainKey] : null;
    
    // AI 합계
    let aiTotal = 0;
    for (const addr of ADOL_AI_WALLETS) {
      const key = Object.keys(walletData.results).find(
        (k) => k.toLowerCase() === addr.toLowerCase()
      );
      if (key && walletData.results[key]) {
        aiTotal += parseAmount(walletData.results[key]);
      }
    }
    const aiAmount = aiTotal > 0 ? `$${aiTotal.toLocaleString()}` : null;
    
    return { main: mainAmount, ai: aiAmount };
  };

  // 아쿠아1 적정가격 계산
  const getAquaFairPrice = (): AquaFairPriceData | undefined => {
    const aquaAddress = '0xD57423c54F188220862391A069a2942c725ee37B';
    
    // 지갑 데이터에서 현재가치 가져오기
    if (!walletData?.results) return undefined;
    const walletKey = Object.keys(walletData.results).find(
      (k) => k.toLowerCase() === aquaAddress.toLowerCase()
    );
    const currentValueStr = walletKey ? walletData.results[walletKey] : null;
    if (!currentValueStr) return undefined;
    const currentValue = parseAmount(currentValueStr);
    
    // 토큰 데이터에서 AQUA1 소각량, 총발행량 가져오기
    const aquaToken = tokenData?.tokens?.find(
      (t: { token_name: string }) => t.token_name === 'AQUA1'
    );
    if (!aquaToken) return undefined;
    
    const totalSupply = aquaToken.total_supply || 207900;
    const burnedAmount = aquaToken.burned_amount || 0;
    const circulation = totalSupply - burnedAmount;
    
    // 블웨바이백 = (총발행량 + 소각량) × 0.03
    const blueWhaleByback = (totalSupply + burnedAmount) * 0.03;
    
    // 적정가격 = (현재가치 - 블웨바이백) / 유통량
    const fairPrice = (currentValue - blueWhaleByback) / circulation;
    
    return {
      fairPrice: Math.max(0, fairPrice),
      blueWhaleByback,
      totalSupply,
      burnedAmount,
      circulation,
      currentValue,
    };
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
              onClick={() => handleTabChange('wallet')}
              className={`pb-3 text-base md:text-lg font-medium transition-colors ${
                selectedTab === 'wallet'
                  ? 'text-white border-b-2 border-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              지갑
            </button>
            <button
              onClick={() => handleTabChange('token')}
              className={`pb-3 text-base md:text-lg font-medium transition-colors ${
                selectedTab === 'token'
                  ? 'text-white border-b-2 border-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              토큰
            </button>
            <button
              onClick={() => handleTabChange('lab')}
              className={`pb-3 text-base md:text-lg font-medium transition-colors ${
                selectedTab === 'lab'
                  ? 'text-white border-b-2 border-white'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              실험실
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
                totalAssets={getAssets(wallet.address, wallet.isBuybackTotal, wallet.isAdolTotal)}
                fundDetails={
                  wallet.isBuybackTotal ? getBuybackDetails() : 
                  wallet.isAdolTotal ? getAdolDetails() : 
                  undefined
                }
                aquaFairPrice={wallet.name === 'Aqua1 펀드' ? getAquaFairPrice() : undefined}
              />
            ))}
          </div>
        )}

        {/* Token 탭 - 소각 현황 */}
        {selectedTab === 'token' && (
          <div className="space-y-4">
            {TOKEN_NAMES.map((tokenName) => {
              const burnData = tokenData?.tokens?.find(
                (t: { token_name: string }) => t.token_name === tokenName
              );
              return (
                <TokenCard
                  key={tokenName}
                  name={tokenName}
                  burnData={burnData}
                />
              );
            })}
          </div>
        )}

        {/* 실험실 탭 */}
        {selectedTab === 'lab' && (
          <div className="space-y-4">
            {/* bUSDC - USDC 카드 */}
            <Card className="bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/80 transition-all duration-200 overflow-hidden group">
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center -space-x-2">
                        <img src="/bUSDC.svg" alt="bUSDC" className="w-8 h-8 rounded-full border-2 border-slate-700" />
                        <img src="/USDC.svg" alt="USDC" className="w-8 h-8 rounded-full border-2 border-slate-700" />
                      </div>
                      <h2 className="text-lg font-semibold text-white">bUSDC - USDC</h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-400">Total Assets:</span>
                      {(() => {
                        const busdcAssets = getAssets(BUSDC_WALLET);
                        return busdcAssets ? (
                          <span className="text-lg font-bold text-emerald-400">{busdcAssets.replace(/\.\d+/, '')}</span>
                        ) : (
                          <span className="text-sm text-slate-500">-</span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <a
                      href={`${PUMPSPACE_BASE_URL}${BUSDC_WALLET}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-md transition-all duration-200 font-medium text-center"
                    >
                      이동
                    </a>
                    <Link
                      href="/wallet/busdc"
                      className="px-6 py-2.5 bg-slate-600 hover:bg-slate-500 text-white rounded-md transition-all duration-200 font-medium text-center"
                    >
                      분석
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
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

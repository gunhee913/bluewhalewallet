'use client';

import dynamic from 'next/dynamic';

const GameClient = dynamic(() => import('./GameClient'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-[#0c4a7a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-300/30 border-t-blue-300 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-blue-200 text-lg">로딩 중...</p>
      </div>
    </div>
  ),
});

export default function GamePage() {
  return (
    <div style={{ touchAction: 'none', overscrollBehavior: 'none', position: 'fixed', inset: 0 }}>
      <GameClient />
    </div>
  );
}

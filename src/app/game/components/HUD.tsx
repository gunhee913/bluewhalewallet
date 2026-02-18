'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../lib/useGameStore';
import { getStageByTier, EVOLUTION_COST } from '../lib/gameConfig';
import { playEvolveSound, setSfxVolume, getSfxVolume, ensureAudioContext } from '../lib/sounds';

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [bgmVol, setBgmVol] = useState(0.3);
  const [sfxVol, setSfxVol] = useState(getSfxVolume());

  const handleBgm = (v: number) => {
    setBgmVol(v);
    const audio = document.querySelector('audio') as HTMLAudioElement | null;
    if (audio) audio.volume = v;
    window.dispatchEvent(new CustomEvent('bgm-volume', { detail: v }));
  };

  const handleSfx = (v: number) => {
    setSfxVol(v);
    setSfxVolume(v);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-[#0d3b5e] rounded-2xl p-6 w-72 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-bold text-lg mb-4 text-center">설정</h2>
        <div className="space-y-4">
          <div>
            <label className="text-white/70 text-sm">BGM 볼륨</label>
            <input type="range" min={0} max={1} step={0.05} value={bgmVol}
              onChange={(e) => handleBgm(parseFloat(e.target.value))}
              className="w-full mt-1 accent-blue-400" />
          </div>
          <div>
            <label className="text-white/70 text-sm">효과음 볼륨</label>
            <input type="range" min={0} max={1} step={0.05} value={sfxVol}
              onChange={(e) => handleSfx(parseFloat(e.target.value))}
              className="w-full mt-1 accent-blue-400" />
          </div>
        </div>
        <button onClick={onClose}
          className="mt-5 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors">
          닫기
        </button>
      </div>
    </div>
  );
}

interface RankingEntry {
  id: number;
  nickname: string;
  score: number;
  tier_reached: number;
  gold_earned: number;
  kill_count: number;
  play_time_ms: number;
}

function RankingList({ onClose }: { onClose: () => void }) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/game/ranking')
      .then((r) => r.json())
      .then((d) => { if (d.success) setRankings(d.rankings || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#0d3b5e] rounded-2xl p-5 w-80 max-h-[70vh] shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-white font-bold text-lg mb-3 text-center">랭킹 TOP 20</h2>
        {loading ? (
          <div className="text-white/40 text-center py-6">불러오는 중...</div>
        ) : rankings.length === 0 ? (
          <div className="text-white/40 text-center py-6">기록이 없습니다</div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
            {rankings.map((r, i) => {
              const tierStage = getStageByTier(r.tier_reached);
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
              return (
                <div key={r.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
                  i < 3 ? 'bg-white/10' : 'bg-white/5'
                }`}>
                  <span className="text-sm w-7 text-center font-bold text-white/60">{medal}</span>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tierStage.color }} />
                  <span className="text-white text-xs font-semibold flex-1 truncate">{r.nickname}</span>
                  <span className="text-yellow-300 text-xs font-bold">{r.score}</span>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={onClose}
          className="mt-3 w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors text-sm">
          닫기
        </button>
      </div>
    </div>
  );
}

function ResultScreen({ isCleared }: { isCleared: boolean }) {
  const score = useGameStore((s) => s.score);
  const killCount = useGameStore((s) => s.killCount);
  const startTime = useGameStore((s) => s.startTime);
  const playerTier = useGameStore((s) => s.playerTier);
  const totalGoldEarned = useGameStore((s) => s.totalGoldEarned);
  const nickname = useGameStore((s) => s.nickname);
  const resetGame = useGameStore((s) => s.resetGame);
  const stage = getStageByTier(playerTier);
  const elapsed = startTime > 0 ? Date.now() - startTime : 0;

  const [myRank, setMyRank] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const prev = localStorage.getItem('blueGameHighScore');
    const hi = prev ? parseInt(prev, 10) : 0;
    if (score > hi) localStorage.setItem('blueGameHighScore', String(score));
  }, [score]);

  useEffect(() => {
    if (saved) return;
    setSaved(true);
    fetch('/api/game/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nickname,
        score,
        tierReached: playerTier,
        goldEarned: totalGoldEarned,
        killCount,
        playTimeMs: elapsed,
      }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.rank) setMyRank(d.rank); })
      .catch(() => {});
  }, []);

  const highScore = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem('blueGameHighScore') || '0', 10)
    : 0;

  const bgColor = isCleared ? 'bg-blue-900/80' : 'bg-red-900/80';
  const title = isCleared ? 'CLEAR!' : 'GAME OVER';
  const titleColor = isCleared ? 'text-yellow-300' : 'text-white';

  return (
    <div className={`fixed inset-0 z-40 flex flex-col items-center justify-center ${bgColor}`}>
      <h1 className={`text-4xl font-bold ${titleColor} mb-3`}>{title}</h1>
      {isCleared ? (
        <p className="text-blue-200 mb-4">WHALE까지 진화 완료!</p>
      ) : (
        <p className="text-red-200 mb-4">{stage.name} ({stage.nameKo}) 단계에서 잡아먹혔습니다</p>
      )}
      <div className="bg-black/30 rounded-xl p-4 mb-4 min-w-[220px] space-y-2">
        {myRank && (
          <div className="flex justify-between text-sm">
            <span className="text-white/60">내 순위</span>
            <span className="text-blue-300 font-bold">#{myRank}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-white/60">점수</span>
          <span className="text-yellow-300 font-bold">{score}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">최고 기록</span>
          <span className="text-yellow-200 font-bold">{Math.max(score, highScore)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">획득 골드</span>
          <span className="text-yellow-400 font-bold">🪙 {totalGoldEarned}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">처치 수</span>
          <span className="text-white font-bold">{killCount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">진행 시간</span>
          <span className="text-white font-bold">{formatTime(elapsed)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">최종 단계</span>
          <span className="text-white font-bold">{stage.name} (Tier {playerTier})</span>
        </div>
      </div>
      <button onClick={resetGame}
        className={`px-8 py-3 ${isCleared ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-red-500 hover:bg-red-600 text-white'} rounded-xl text-lg font-semibold transition-colors`}>
        다시 시작
      </button>
    </div>
  );
}

const EFFECT_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  speed: { emoji: '⚡', label: '가속', color: '#ffdd00' },
  magnet: { emoji: '🧲', label: '자석', color: '#aa44ff' },
  shield: { emoji: '🛡️', label: '쉴드', color: '#44aaff' },
  exp2x: { emoji: '⭐', label: 'EXP x2', color: '#44ff44' },
};

const EVENT_LABELS: Record<string, { emoji: string; label: string; color: string }> = {
  frenzy: { emoji: '🐟', label: '먹이 폭발!', color: '#44ff88' },
  current: { emoji: '🌊', label: '해류 발생!', color: '#44aaff' },
  darkness: { emoji: '🌑', label: '심해 어둠!', color: '#8844aa' },
};

function ComboDisplay() {
  const combo = useGameStore((s) => s.combo);
  const lastEatTime = useGameStore((s) => s.lastEatTime);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (combo >= 2) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(timer);
    }
    setVisible(false);
  }, [combo, lastEatTime]);

  if (!visible || combo < 2) return null;

  const multiplier = combo >= 10 ? 3 : combo >= 5 ? 2 : combo >= 3 ? 1.5 : 1;
  const scale = Math.min(1.5, 0.8 + combo * 0.1);

  return (
    <div className="fixed z-50 pointer-events-none" style={{ top: '30%', left: '50%', transform: 'translate(-50%, -50%)' }}>
      <div style={{ transform: `scale(${scale})`, transition: 'transform 0.1s' }} className="text-center">
        <div className="text-yellow-300 font-bold text-3xl drop-shadow-lg"
          style={{ textShadow: '0 0 10px rgba(255,200,0,0.5)' }}>
          {combo}x COMBO!
        </div>
        {multiplier > 1 && (
          <div className="text-orange-300 text-sm font-bold">EXP x{multiplier}</div>
        )}
      </div>
    </div>
  );
}

function DashCooldownPC() {
  const dashCooldownEnd = useGameStore((s) => s.dashCooldownEnd);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      if (now < dashCooldownEnd) {
        setPct(Math.min(100, ((dashCooldownEnd - now) / 4000) * 100));
      } else {
        setPct(0);
      }
    }, 50);
    return () => clearInterval(iv);
  }, [dashCooldownEnd]);

  return (
    <div className="bg-black/40 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1">
      <span className="text-[10px] sm:text-xs text-white/60">Shift</span>
      <div className="w-6 h-6 sm:w-7 sm:h-7 relative rounded-full border border-white/30 flex items-center justify-center overflow-hidden">
        {pct > 0 && (
          <div className="absolute inset-0 bg-blue-400/40" style={{ clipPath: `inset(${100 - pct}% 0 0 0)` }} />
        )}
        <span className="text-[9px] text-white font-bold z-10">{pct > 0 ? Math.ceil(pct / 25) : '⚡'}</span>
      </div>
    </div>
  );
}

function ActiveEffectsBar() {
  const activeEffects = useGameStore((s) => s.activeEffects);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => forceUpdate((v) => v + 1), 200);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const live = activeEffects.filter((e) => e.endTime > now);
  if (live.length === 0) return null;

  return (
    <div className="fixed top-14 sm:top-16 left-2 sm:left-4 z-40 flex gap-1.5 pointer-events-none">
      {live.map((eff) => {
        const info = EFFECT_LABELS[eff.type];
        const remaining = Math.ceil((eff.endTime - now) / 1000);
        return (
          <div key={eff.type} className="bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-1"
            style={{ borderLeft: `3px solid ${info.color}` }}>
            <span className="text-sm">{info.emoji}</span>
            <span className="text-[10px] text-white/80">{remaining}s</span>
          </div>
        );
      })}
    </div>
  );
}

function EventBanner() {
  const activeEvent = useGameStore((s) => s.activeEvent);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => forceUpdate((v) => v + 1), 200);
    return () => clearInterval(iv);
  }, []);

  if (!activeEvent) return null;
  const now = Date.now();
  if (now > activeEvent.endTime) return null;

  const info = EVENT_LABELS[activeEvent.type];
  const remaining = Math.ceil((activeEvent.endTime - now) / 1000);

  return (
    <div className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
      <div className="bg-black/60 backdrop-blur-sm rounded-xl px-4 py-1.5 flex items-center gap-2"
        style={{ borderBottom: `2px solid ${info.color}` }}>
        <span className="text-lg">{info.emoji}</span>
        <span className="text-white font-bold text-xs sm:text-sm">{info.label}</span>
        <span className="text-white/60 text-[10px]">{remaining}s</span>
      </div>
    </div>
  );
}

function BossWarning() {
  const boss = useGameStore((s) => s.boss);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (boss?.alive) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [boss?.alive]);

  if (!boss?.alive) return null;

  return (
    <>
      {flash && (
        <div className="fixed inset-0 z-30 pointer-events-none animate-pulse"
          style={{ boxShadow: 'inset 0 0 80px rgba(255,0,0,0.3)' }} />
      )}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
        <div className="bg-red-900/80 backdrop-blur-sm rounded-xl px-4 py-2 flex items-center gap-2 animate-pulse">
          <span className="text-lg">🦈</span>
          <span className="text-red-200 font-bold text-xs sm:text-sm">보스 출현!</span>
        </div>
      </div>
    </>
  );
}

export default function HUD() {
  const playerTier = useGameStore((s) => s.playerTier);
  const exp = useGameStore((s) => s.exp);
  const score = useGameStore((s) => s.score);
  const isStarted = useGameStore((s) => s.isStarted);
  const isGameOver = useGameStore((s) => s.isGameOver);
  const isCleared = useGameStore((s) => s.isCleared);
  const isPaused = useGameStore((s) => s.isPaused);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const togglePause = useGameStore((s) => s.togglePause);

  const stage = getStageByTier(playerTier);
  const expPercent = stage.expToNext === Infinity ? 100 : (exp / stage.expToNext) * 100;

  const [evolveMsg, setEvolveMsg] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const prevTierRef = useRef(playerTier);

  useEffect(() => {
    if (playerTier > prevTierRef.current && isStarted) {
      const newStage = getStageByTier(playerTier);
      setEvolveMsg(`${newStage.name} (${newStage.nameKo})로 진화!`);
      playEvolveSound();
      const timer = setTimeout(() => setEvolveMsg(null), 2500);
      prevTierRef.current = playerTier;
      return () => clearTimeout(timer);
    }
    prevTierRef.current = playerTier;
  }, [playerTier, isStarted]);

  const showUpgradePanel = useGameStore((s) => s.showUpgradePanel);

  const handlePauseKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isStarted && !isGameOver && !isCleared) {
      if (showUpgradePanel) return;
      togglePause();
    }
  }, [isStarted, isGameOver, isCleared, togglePause, showUpgradePanel]);

  useEffect(() => {
    window.addEventListener('keydown', handlePauseKey);
    return () => window.removeEventListener('keydown', handlePauseKey);
  }, [handlePauseKey]);

  const nickname = useGameStore((s) => s.nickname);
  const setNickname = useGameStore((s) => s.setNickname);
  const [showRanking, setShowRanking] = useState(false);
  const gold = useGameStore((s) => s.gold);
  const toggleUpgradePanel = useGameStore((s) => s.toggleUpgradePanel);

  if (!isStarted) {
    const canStart = nickname.trim().length > 0;
    return (
      <>
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#0c4a7a]/80 px-6">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 sm:mb-4 tracking-wider">고래키우기</h1>
          <p className="text-base sm:text-lg text-blue-200 mb-4 sm:mb-6">바다를 헤엄치며 진화하세요</p>
          <div className="mb-4 sm:mb-6 w-full max-w-[240px]">
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 12))}
              placeholder="닉네임 입력"
              maxLength={12}
              className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white text-center text-sm placeholder-white/40 outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
              onKeyDown={(e) => { if (e.key === 'Enter' && canStart) { ensureAudioContext(); startGame(); } }}
              autoComplete="off"
              style={{ fontSize: '16px' }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { if (canStart) { ensureAudioContext(); startGame(); } }}
              disabled={!canStart}
              className={`px-8 py-3 rounded-xl text-lg font-semibold transition-colors ${
                canStart
                  ? 'bg-blue-500 hover:bg-blue-600 text-white'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              }`}
            >
              게임 시작
            </button>
            <button
              onClick={() => setShowRanking(true)}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-lg font-semibold transition-colors"
            >
              🏆
            </button>
          </div>
          <p className="text-[10px] sm:text-xs text-blue-300/50 mt-4 sm:mt-6 text-center">
            PC: WASD 이동 + 마우스 시점 + Shift 돌진 | 모바일: 조이스틱 + 터치 + 돌진 | ESC: 일시정지
          </p>
        </div>
        {showRanking && <RankingList onClose={() => setShowRanking(false)} />}
      </>
    );
  }

  if (isGameOver) return <ResultScreen isCleared={false} />;
  if (isCleared) return <ResultScreen isCleared={true} />;

  return (
    <>
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 pointer-events-none">
        <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 gap-1 sm:gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/40 backdrop-blur-sm rounded-xl px-2 sm:px-4 py-1.5 sm:py-2">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full" style={{ backgroundColor: stage.color }} />
            <span className="text-white font-bold text-xs sm:text-sm">{stage.name}</span>
            <span className="text-white/60 text-[10px] sm:text-xs">T{playerTier}</span>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-end">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1">
              <span className="text-yellow-400 text-[10px] sm:text-xs">🪙</span>
              <span className="text-yellow-300 text-[10px] sm:text-xs font-bold">{gold}</span>
            </div>
            <DashCooldownPC />
            <div className="bg-black/40 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1.5 sm:py-2">
              <span className="text-yellow-300 text-[10px] sm:text-xs font-bold">{score}</span>
            </div>
            <button onClick={toggleUpgradePanel}
              className="pointer-events-auto bg-gradient-to-b from-yellow-500/80 to-yellow-600/80 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 hover:from-yellow-400/80 hover:to-yellow-500/80 transition-all active:scale-95 border border-yellow-400/30">
              <span className="text-white text-[10px] sm:text-xs font-bold">⬆</span>
            </button>
            <button onClick={togglePause}
              className="pointer-events-auto bg-black/40 backdrop-blur-sm rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-black/60 transition-colors">
              <span className="text-white text-[10px] sm:text-xs">| |</span>
            </button>
          </div>
        </div>
      </div>

      <ActiveEffectsBar />
      <EventBanner />
      <ComboDisplay />
      <BossWarning />

      {/* Pause overlay */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/60">
          <h2 className="text-3xl font-bold text-white mb-6">일시정지</h2>
          <div className="flex flex-col gap-3 min-w-[200px]">
            <button onClick={togglePause}
              className="py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold transition-colors">
              계속하기
            </button>
            <button onClick={() => setShowSettings(true)}
              className="py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-colors">
              설정
            </button>
            <button onClick={() => { togglePause(); resetGame(); }}
              className="py-3 bg-red-500/80 hover:bg-red-600 text-white rounded-xl font-semibold transition-colors">
              메인으로
            </button>
          </div>
        </div>
      )}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Evolve message */}
      {evolveMsg && (
        <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
          <div className="animate-bounce bg-yellow-400/90 backdrop-blur-sm rounded-2xl px-8 py-4 shadow-lg">
            <p className="text-2xl font-bold text-black text-center">{evolveMsg}</p>
          </div>
        </div>
      )}
    </>
  );
}

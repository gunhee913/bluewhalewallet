'use client';

import { useGameStore } from '../lib/useGameStore';
import { RARITY_COLORS, RARITY_LABELS } from '../lib/gamePerks';

export default function PerkSelection() {
  const showPerkSelection = useGameStore((s) => s.showPerkSelection);
  const perkChoices = useGameStore((s) => s.perkChoices);
  const selectPerk = useGameStore((s) => s.selectPerk);
  const skipPerks = useGameStore((s) => s.skipPerks);

  if (!showPerkSelection || !perkChoices || perkChoices.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">진화 보너스 선택</h2>
          <p className="mt-1 text-sm text-white/70">하나를 선택하여 영구 보너스를 획득하세요</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          {perkChoices.map((perk) => {
            const borderColor = RARITY_COLORS[perk.rarity];
            const rarityLabel = RARITY_LABELS[perk.rarity];

            return (
              <button
                key={perk.id}
                onClick={() => selectPerk(perk.id)}
                className="group flex-1 rounded-xl border-2 bg-gray-900/90 p-4 text-left transition-all hover:scale-[1.03] hover:bg-gray-800/90 active:scale-[0.98] sm:p-5"
                style={{ borderColor }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl">{perk.icon}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{ backgroundColor: borderColor + '30', color: borderColor }}
                  >
                    {rarityLabel}
                  </span>
                </div>
                <h3 className="mb-1 text-base font-bold text-white sm:text-lg">{perk.name}</h3>
                <p className="text-sm text-white/70">{perk.description}</p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={skipPerks}
            className="rounded-lg px-4 py-2 text-sm text-white/50 transition-colors hover:text-white/80"
          >
            건너뛰기
          </button>
        </div>
      </div>
    </div>
  );
}

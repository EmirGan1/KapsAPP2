import React from 'react';

export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  id?: string;
}

interface PlayingCardProps {
  card?: Card | null;
  faceDown?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isPlayable?: boolean;
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  className?: string;
  badge?: string;
  glow?: 'emerald' | 'amber' | 'rose' | 'blue' | 'none';
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

export const SUIT_NAMES_TR: Record<Suit, string> = {
  spades: 'Maça',
  hearts: 'Kupa',
  diamonds: 'Karo',
  clubs: 'Sinek'
};

export const SUIT_COLORS: Record<Suit, { text: string; bg: string; fill: string }> = {
  spades: { text: 'text-slate-900', bg: 'bg-slate-900', fill: '#0f172a' },
  hearts: { text: 'text-rose-600', bg: 'bg-rose-600', fill: '#e11d48' },
  diamonds: { text: 'text-rose-600', bg: 'bg-rose-600', fill: '#e11d48' },
  clubs: { text: 'text-slate-900', bg: 'bg-slate-900', fill: '#0f172a' }
};

export default function PlayingCard({
  card,
  faceDown = false,
  size = 'md',
  isPlayable = true,
  isSelected = false,
  isDisabled = false,
  onClick,
  className = '',
  badge,
  glow = 'none'
}: PlayingCardProps) {
  // Dimension tokens
  const sizeClasses = {
    xs: 'w-8 h-12 text-[10px] rounded-md',
    sm: 'w-11 h-16 text-xs rounded-lg',
    md: 'w-14 h-20 sm:w-16 sm:h-24 text-sm rounded-xl',
    lg: 'w-18 h-26 sm:w-20 sm:h-28 text-base rounded-2xl',
    xl: 'w-22 h-32 sm:w-24 sm:h-36 text-lg rounded-2xl'
  }[size];

  // Glow styles
  const glowClasses = {
    emerald: 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-500/40',
    amber: 'ring-2 ring-amber-400 shadow-lg shadow-amber-500/40',
    rose: 'ring-2 ring-rose-500 shadow-lg shadow-rose-500/40',
    blue: 'ring-2 ring-blue-400 shadow-lg shadow-blue-500/40',
    none: ''
  }[glow];

  if (faceDown || !card) {
    return (
      <div
        onClick={onClick}
        className={`relative select-none shrink-0 border border-amber-500/40 shadow-md transition-all duration-200 overflow-hidden ${sizeClasses} ${className} ${
          onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''
        }`}
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)'
        }}
      >
        {/* Geometric Luxury Card Back Pattern */}
        <div className="absolute inset-1 border border-amber-400/30 rounded-lg overflow-hidden flex items-center justify-center p-0.5">
          <div className="w-full h-full border border-amber-400/20 rounded flex items-center justify-center bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:6px_6px] opacity-40" />
          <div className="absolute w-5 h-5 sm:w-7 sm:h-7 rounded-full border border-amber-400/50 bg-slate-950/80 flex items-center justify-center text-[10px] sm:text-xs font-black text-amber-400 shadow-inner">
            ✦
          </div>
        </div>
      </div>
    );
  }

  const { suit, rank } = card;
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const suitSymbol = SUIT_SYMBOLS[suit];
  const textColor = isRed ? 'text-rose-600' : 'text-slate-900';

  const isFaceCard = rank === 'J' || rank === 'Q' || rank === 'K' || rank === 'A';
  const faceEmoji = rank === 'J' ? '⚔️' : rank === 'Q' ? '👑' : rank === 'K' ? '🤴' : rank === 'A' ? '✦' : null;

  return (
    <div
      onClick={!isDisabled ? onClick : undefined}
      className={`relative select-none shrink-0 bg-white border border-slate-300 dark:border-slate-200 shadow-md transition-all duration-200 flex flex-col justify-between p-1 sm:p-1.5 overflow-hidden ${sizeClasses} ${glowClasses} ${
        isDisabled
          ? 'opacity-40 grayscale-[40%] cursor-not-allowed pointer-events-none'
          : isPlayable && onClick
          ? 'cursor-pointer hover:-translate-y-2 hover:shadow-xl active:scale-95'
          : ''
      } ${isSelected ? '-translate-y-3 ring-2 ring-emerald-400 shadow-xl' : ''} ${className}`}
      style={{
        boxShadow: isSelected
          ? '0 10px 25px -5px rgba(16, 185, 129, 0.4), 0 8px 10px -6px rgba(16, 185, 129, 0.2)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.15), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
      }}
    >
      {/* Top-Left Index */}
      <div className={`flex flex-col items-center leading-none ${textColor} font-black select-none pointer-events-none self-start`}>
        <span className="tracking-tighter font-extrabold text-[11px] sm:text-xs">{rank}</span>
        <span className="text-[10px] sm:text-xs -mt-0.5">{suitSymbol}</span>
      </div>

      {/* Center Art / Large Suit */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isFaceCard && faceEmoji ? (
          <div className="flex flex-col items-center justify-center">
            <span className="text-sm sm:text-lg opacity-80">{faceEmoji}</span>
            <span className={`text-base sm:text-xl font-black ${textColor} opacity-90 -mt-1`}>{suitSymbol}</span>
          </div>
        ) : (
          <span className={`text-xl sm:text-2xl font-black ${textColor} opacity-85`}>
            {suitSymbol}
          </span>
        )}
      </div>

      {/* Bottom-Right Index (Rotated 180deg) */}
      <div className={`flex flex-col items-center leading-none ${textColor} font-black select-none pointer-events-none self-end rotate-180`}>
        <span className="tracking-tighter font-extrabold text-[11px] sm:text-xs">{rank}</span>
        <span className="text-[10px] sm:text-xs -mt-0.5">{suitSymbol}</span>
      </div>

      {/* Optional Badge */}
      {badge && (
        <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black uppercase tracking-wider shadow">
          {badge}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { X, Plus, Users, Play, Shield, Bot, Flame, DollarSign, Trophy } from 'lucide-react';
import Avatar from './Avatar';

export interface CardTableInfo {
  id: string;
  gameType: 'blackjack' | 'batak';
  title: string;
  hostId: number;
  hostName: string;
  hostAvatar?: string | null;
  playerCount: number;
  maxPlayers: number;
  botCount: number;
  status: 'Lobi Bekliyor' | 'Oyunda';
  minBet?: number;
  gameMode?: string;
}

interface CardTableLobbyModalProps {
  gameType: 'blackjack' | 'batak';
  isOpen: boolean;
  onClose: () => void;
  onCreateTable: (options: { title: string; minBet?: number; gameMode?: 'ihale' | 'koz_maca'; targetRounds?: number }) => void;
  onJoinTable: (tableId: string) => void;
  activeTables: CardTableInfo[];
}

export default function CardTableLobbyModal({
  gameType,
  isOpen,
  onClose,
  onCreateTable,
  onJoinTable,
  activeTables
}: CardTableLobbyModalProps) {
  const [tab, setTab] = useState<'browse' | 'create'>('create');
  const [title, setTitle] = useState<string>(
    gameType === 'blackjack' ? 'VIP Blackjack 21 Masası' : '4 Kişilik İhaleli Batak Masası'
  );
  const [minBet, setMinBet] = useState<number>(25);
  const [gameMode, setGameMode] = useState<'ihale' | 'koz_maca'>('ihale');
  const [targetRounds, setTargetRounds] = useState<number>(5);

  if (!isOpen) return null;

  const filteredTables = activeTables.filter(t => t.gameType === gameType);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{gameType === 'blackjack' ? '🃏' : '♠️'}</span>
            <div>
              <h2 className="text-lg font-black text-slate-100">
                {gameType === 'blackjack' ? 'Blackjack 21 Lobisi' : 'Batak Masaları'}
              </h2>
              <p className="text-xs text-slate-400">Masa kur veya açık masalara tek tıkla otur</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex p-2 bg-slate-950 border-b border-slate-800 gap-2">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'create'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus size={14} /> + Yeni Masa Kur
          </button>
          <button
            onClick={() => setTab('browse')}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'browse'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={14} /> Açık Masalar ({filteredTables.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {tab === 'create' ? (
            <div className="space-y-4">
              {/* Table Title */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Masa Adı</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masa başlığı..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Game Specific Options */}
              {gameType === 'blackjack' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Minimum Bahis Çipi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 25, 50, 100, 250, 500].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setMinBet(b)}
                        className={`py-2 rounded-xl font-black text-xs transition-all ${
                          minBet === b
                            ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {b}$ Min
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Oyun Modu</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGameMode('ihale')}
                        className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                          gameMode === 'ihale'
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        İhaleli Batak
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameMode('koz_maca')}
                        className={`py-2.5 rounded-xl font-black text-xs transition-all ${
                          gameMode === 'koz_maca'
                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        Koz Maça
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">Hedef El Sayısı</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 9, 11].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setTargetRounds(r)}
                          className={`py-2 rounded-xl font-black text-xs transition-all ${
                            targetRounds === r
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {r} El
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Action */}
              <button
                type="button"
                onClick={() => {
                  onCreateTable({
                    title: title.trim() || (gameType === 'blackjack' ? 'Blackjack VIP' : 'Batak Masası'),
                    minBet,
                    gameMode,
                    targetRounds
                  });
                  onClose();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-[1.02] active:scale-95"
              >
                <Play size={16} /> MASAYI BAŞLAT
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTables.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <Users size={36} className="mx-auto mb-2 opacity-30 text-emerald-400" />
                  <p className="font-bold text-xs">Şu an açık canlı masa bulunmuyor.</p>
                  <p className="text-[11px] text-slate-500 mt-1">İlk masayı sen kur ve oyunu başlat!</p>
                </div>
              ) : (
                filteredTables.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Avatar url={t.hostAvatar} name={t.hostName} size={8} />
                      <div className="min-w-0">
                        <h4 className="font-black text-xs text-slate-100 truncate">{t.title}</h4>
                        <span className="text-[10px] text-slate-400 block">
                          Host: {t.hostName} • {t.playerCount}/{t.maxPlayers} Oyuncu ({t.botCount} Bot)
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onJoinTable(t.id);
                        onClose();
                      }}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shrink-0 cursor-pointer"
                    >
                      Masaya Otur
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

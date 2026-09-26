import React, { useState } from 'react';
import { X, Plus, Users, Play, Shield, Bot, Flame, DollarSign, Lock, Unlock, KeyRound, Sparkles } from 'lucide-react';
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
  maxBet?: number;
  minBalance?: number;
  isPrivate?: boolean;
  passcode?: string;
  gameMode?: string;
  isBotHost?: boolean;
}

export interface CreateTableOptions {
  title: string;
  isPrivate?: boolean;
  passcode?: string;
  minBalance?: number;
  minBet?: number;
  maxBet?: number;
  gameMode?: 'ihale' | 'koz_maca';
  targetRounds?: number;
}

interface CardTableLobbyModalProps {
  gameType: 'blackjack' | 'batak';
  isOpen: boolean;
  onClose: () => void;
  currentUsername?: string;
  currentUserChips?: number;
  onCreateTable: (options: CreateTableOptions) => void;
  onJoinTable: (tableId: string, passcode?: string) => void;
  activeTables: CardTableInfo[];
}

export default function CardTableLobbyModal({
  gameType,
  isOpen,
  onClose,
  currentUsername = 'Oyuncu',
  currentUserChips = 1000,
  onCreateTable,
  onJoinTable,
  activeTables
}: CardTableLobbyModalProps) {
  const [tab, setTab] = useState<'create' | 'browse'>('create');
  
  // Table Configuration States
  const [title, setTitle] = useState<string>(
    gameType === 'blackjack' ? `${currentUsername}'in Masası` : `${currentUsername}'in Batak Masası`
  );
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [passcode, setPasscode] = useState<string>('');
  
  // Presets - Sorted strictly from smallest to largest
  const [minBalance, setMinBalance] = useState<number>(0); // 0 = Limitsiz
  const [minBet, setMinBet] = useState<number>(50);
  const [maxBet, setMaxBet] = useState<number>(2500);

  // Batak Specific States
  const [gameMode, setGameMode] = useState<'ihale' | 'koz_maca'>('ihale');
  const [targetRounds, setTargetRounds] = useState<number>(5);

  // Private table join prompt state
  const [promptJoinTable, setPromptJoinTable] = useState<CardTableInfo | null>(null);
  const [inputPasscode, setInputPasscode] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter out any fake bot tables - ONLY real human hosts listed
  const realActiveTables = activeTables.filter(
    (t) => t.gameType === gameType && t.hostId > 0 && !t.isBotHost && !t.hostName.toLowerCase().startsWith('bot ')
  );

  const handleStartTable = () => {
    if (isPrivate && passcode.length < 4) {
      alert('Lütfen özel masa için 4 haneli bir şifre / masa kodu belirleyin.');
      return;
    }

    onCreateTable({
      title: title.trim() || `${currentUsername}'in Masası`,
      isPrivate,
      passcode: isPrivate ? passcode : undefined,
      minBalance,
      minBet,
      maxBet,
      gameMode,
      targetRounds
    });
    onClose();
  };

  const handleJoinClick = (table: CardTableInfo) => {
    if (table.isPrivate) {
      setPromptJoinTable(table);
      setInputPasscode('');
      setPasscodeError(null);
    } else {
      onJoinTable(table.id);
      onClose();
    }
  };

  const handleConfirmPrivateJoin = () => {
    if (!promptJoinTable) return;
    if (promptJoinTable.passcode && promptJoinTable.passcode !== inputPasscode.trim()) {
      setPasscodeError('Hatalı masa şifresi! Lütfen tekrar deneyin.');
      return;
    }
    onJoinTable(promptJoinTable.id, inputPasscode.trim());
    setPromptJoinTable(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border-2 border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{gameType === 'blackjack' ? '🃏' : '♠️'}</span>
            <div>
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <span>{gameType === 'blackjack' ? 'Blackjack 21 Masa Yönetimi' : 'Batak Masaları'}</span>
              </h2>
              <p className="text-xs text-slate-400">
                Arkadaşlarınla oyna, masa kur veya canlı odalara katıl
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex p-2 bg-slate-950 border-b border-slate-800 gap-2">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'create'
                ? 'bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-400'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
            }`}
          >
            <Plus size={14} /> + Yeni Masa Kur
          </button>
          <button
            onClick={() => setTab('browse')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              tab === 'browse'
                ? 'bg-emerald-600 text-white shadow-lg ring-1 ring-emerald-400'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900/60'
            }`}
          >
            <Users size={14} /> Canlı Masalar ({realActiveTables.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {tab === 'create' ? (
            <div className="space-y-4">
              
              {/* 1. Table Title */}
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1.5">Masa Adı</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Masa adı..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* 2. Table Privacy Type */}
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1.5">Masa Tipi & Gizlilik</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      !isPrivate
                        ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Unlock size={14} /> Herkese Açık (Public)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      isPrivate
                        ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500'
                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Lock size={14} /> Özel / Şifreli (Private)
                  </button>
                </div>

                {isPrivate && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-950 border border-amber-500/40 space-y-1.5">
                    <label className="block text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <KeyRound size={12} /> 4 Haneli Masa Şifresi / Kodu:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={passcode}
                      onChange={(e) => setPasscode(e.target.value)}
                      placeholder="Örn: 1234"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-amber-400 font-mono font-black text-sm tracking-widest text-center focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Arkadaşların masaya katılırken bu kodu girerek odaya dahil olabilir.
                    </p>
                  </div>
                )}
              </div>

              {/* Blackjack Specific Options */}
              {gameType === 'blackjack' ? (
                <>
                  {/* 3. Minimum Giriş Bakiyesi (Min Balance Requirement) */}
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>Minimum Giriş Bakiyesi</span>
                      <span className="text-[11px] text-slate-400 font-normal">Masa Şartı</span>
                    </label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { val: 1000, label: '1.000$' },
                        { val: 5000, label: '5.000$' },
                        { val: 25000, label: '25.000$' },
                        { val: 100000, label: '100.000$' },
                        { val: 0, label: 'Limitsiz' }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setMinBalance(item.val)}
                          className={`py-2 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                            minBalance === item.val
                              ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500 shadow-sm'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Minimum Bahis (Min Bet) */}
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">Minimum Bahis (Min Bet)</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { val: 10, label: '10$' },
                        { val: 50, label: '50$' },
                        { val: 100, label: '100$' },
                        { val: 500, label: '500$' },
                        { val: 1000, label: '1.000$' }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setMinBet(item.val)}
                          className={`py-2 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                            minBet === item.val
                              ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500 shadow-sm'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 5. Maksimum Bahis (Max Bet) */}
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">Maksimum Bahis (Max Bet)</label>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[
                        { val: 500, label: '500$' },
                        { val: 2500, label: '2.500$' },
                        { val: 10000, label: '10.000$' },
                        { val: 50000, label: '50.000$' },
                        { val: 0, label: 'Limitsiz' }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setMaxBet(item.val)}
                          className={`py-2 rounded-xl font-black text-[11px] transition-all cursor-pointer ${
                            maxBet === item.val
                              ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500 shadow-sm'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* Batak Options */
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">Oyun Modu</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGameMode('ihale')}
                        className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                          gameMode === 'ihale'
                            ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        İhaleli Batak
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameMode('koz_maca')}
                        className={`py-2.5 rounded-xl font-black text-xs transition-all cursor-pointer ${
                          gameMode === 'koz_maca'
                            ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        Koz Maça
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-300 mb-1.5">Hedef El Sayısı</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 9, 11].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setTargetRounds(r)}
                          className={`py-2 rounded-xl font-black text-xs transition-all cursor-pointer ${
                            targetRounds === r
                              ? 'ring-2 ring-emerald-400 bg-emerald-600/20 text-emerald-400 border border-emerald-500'
                              : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {r} El
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={handleStartTable}
                className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all transform hover:scale-[1.01] active:scale-95"
              >
                <Play size={16} /> MASAYI KUR VE OYNA
              </button>
            </div>
          ) : (
            /* Browse Active Tables - Real Users Only */
            <div className="space-y-3">
              {promptJoinTable ? (
                <div className="p-4 rounded-2xl bg-slate-950 border-2 border-amber-500/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock size={16} className="text-amber-400" />
                      <h4 className="font-black text-xs text-amber-300">Özel Masa Şifresi</h4>
                    </div>
                    <button
                      onClick={() => setPromptJoinTable(null)}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      İptal
                    </button>
                  </div>
                  <p className="text-xs text-slate-300">
                    <strong>{promptJoinTable.title}</strong> masasına katılmak için kurucunun belirlediği şifreyi girin:
                  </p>
                  <input
                    type="password"
                    value={inputPasscode}
                    onChange={(e) => {
                      setInputPasscode(e.target.value);
                      setPasscodeError(null);
                    }}
                    placeholder="Masa şifresi..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 font-mono font-bold text-center text-sm focus:outline-none focus:border-amber-500"
                  />
                  {passcodeError && (
                    <p className="text-xs text-rose-400 font-bold">{passcodeError}</p>
                  )}
                  <button
                    onClick={handleConfirmPrivateJoin}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow cursor-pointer transition-colors"
                  >
                    Masaya Katıl
                  </button>
                </div>
              ) : realActiveTables.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Users size={40} className="mx-auto mb-2 opacity-30 text-emerald-400" />
                  <p className="font-bold text-xs text-slate-300">Şu an açık canlı masa bulunmuyor.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Yapay zeka (bot) masaları lobide listelenmez. İlk canlı masayı sen kur ve arkadaşlarını davet et!
                  </p>
                </div>
              ) : (
                realActiveTables.map((t) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between gap-3 transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar url={t.hostAvatar} name={t.hostName} size={9} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-black text-xs text-slate-100 truncate">{t.title}</h4>
                          {t.isPrivate && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center gap-0.5">
                              <Lock size={10} /> Şifreli
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Kurucu: <strong className="text-slate-300">{t.hostName}</strong> • {t.playerCount}/{t.maxPlayers} Koltuk Dolu
                        </span>
                        {t.minBet && (
                          <span className="text-[10px] text-emerald-400 font-bold block">
                            Min Bahis: {t.minBet}$
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinClick(t)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shrink-0 cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <span>Masaya Otur</span>
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

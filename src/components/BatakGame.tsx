import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  ArrowLeft, Users, Bot, Plus, RefreshCw, Trophy, Shield, 
  HelpCircle, Settings, X, Check, Flame, Crown, Eye, Zap, Coins
} from 'lucide-react';
import PlayingCard, { Card, Suit, SUIT_SYMBOLS, SUIT_NAMES_TR } from './PlayingCard';
import Avatar from './Avatar';
import AdminChipManagerModal from './AdminChipManagerModal';
import { 
  BatakState, BatakPlayer, PlayedCard, 
  sortBatakHand, getValidBatakCards, evaluateTrickWinner, 
  decideBotBatakBid, decideBotBatakCard, dealBatakHands, 
  initializeBatakTable 
} from '../utils/batakEngine';

interface BatakGameProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  tableId?: string | null;
  onBackToHub: () => void;
}

const BOT_NAMES = ['Bot Mert', 'Bot Zeynep', 'Bot Kaan', 'Bot Selin'];

export default function BatakGame({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  tableId,
  onBackToHub
}: BatakGameProps) {
  const [table, setTable] = useState<BatakState>(() =>
    initializeBatakTable(tableId || 'batak_local', 'İhaleli Batak Masası', currentUserId, username, avatar, color, 'ihale')
  );

  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [selectedBid, setSelectedBid] = useState<number>(5);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'win' | 'lose' | 'info' | 'trump' } | null>(null);

  const isHost = table.hostId === currentUserId;
  const isEmirgan = username?.toLowerCase().trim() === 'emirgan';
  const myPlayer = table.players.find(p => p.userId === currentUserId) || table.players[0];
  const mySeatIndex = myPlayer ? myPlayer.seatIndex : 0;

  // Banner helper
  const showBanner = (text: string, type: 'win' | 'lose' | 'info' | 'trump' = 'info', duration = 3000) => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), duration);
  };

  // --- Socket.io Sync ---
  useEffect(() => {
    if (!socket) return;

    const onTableState = (syncedTable: BatakState) => {
      if (syncedTable && syncedTable.id === table.id) {
        setTable(syncedTable);
      }
    };

    socket.on('batak_state', onTableState);
    socket.emit('get_batak_state', { tableId: table.id });

    return () => {
      socket.off('batak_state', onTableState);
    };
  }, [socket, table.id]);

  const broadcastTable = useCallback((newTable: BatakState) => {
    setTable(newTable);
    if (socket && socket.connected) {
      socket.emit('batak_update_state', newTable);
    }
  }, [socket]);

  // --- Bot / Turn Runner Engine ---
  useEffect(() => {
    if (!isHost) return;

    let timer: NodeJS.Timeout | null = null;

    // 1. BIDDING Phase for Bots
    if (table.phase === 'BIDDING') {
      const activePlayer = table.players[table.turnSeatIndex];
      if (activePlayer && activePlayer.isBot && !activePlayer.isBiddingFinished) {
        timer = setTimeout(() => {
          const { bid } = decideBotBatakBid(activePlayer.hand, table.highestBid, table.gameMode === 'koz_maca');
          handlePlayerBid(table.turnSeatIndex, bid);
        }, 900);
      }
    }

    // 2. TRUMP SELECTION Phase for Bot
    if (table.phase === 'TRUMP_SELECTION') {
      const bidWinner = table.players[table.bidWinnerSeat!];
      if (bidWinner && bidWinner.isBot) {
        timer = setTimeout(() => {
          const { preferredTrump } = decideBotBatakBid(bidWinner.hand, table.highestBid, false);
          handleSelectTrump(preferredTrump);
        }, 1000);
      }
    }

    // 3. PLAYING Phase for Bots
    if (table.phase === 'PLAYING') {
      const activePlayer = table.players[table.turnSeatIndex];
      if (activePlayer && activePlayer.isBot && activePlayer.hand.length > 0) {
        timer = setTimeout(() => {
          const cardToPlay = decideBotBatakCard(
            activePlayer.hand,
            table.currentTrick,
            table.trumpSuit!,
            table.isTrumpBroken,
            activePlayer.bid,
            activePlayer.tricksWon
          );
          handlePlayCard(table.turnSeatIndex, cardToPlay);
        }, 900);
      }
    }

    // 4. TRICK_END Resolution
    if (table.phase === 'TRICK_END') {
      timer = setTimeout(() => {
        resolveTrickEnd();
      }, 1400);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [table.phase, table.turnSeatIndex, table.players, isHost]);

  // --- Bidding Actions ---
  const handlePlayerBid = (seatIndex: number, bid: number) => {
    const nextPlayers = [...table.players];
    const player = nextPlayers[seatIndex];
    if (!player) return;

    nextPlayers[seatIndex] = {
      ...player,
      bid,
      isBiddingFinished: true
    };

    let nextHighestBid = table.highestBid;
    let nextBidWinner = table.bidWinnerSeat;

    if (bid > 0 && bid > nextHighestBid) {
      nextHighestBid = bid;
      nextBidWinner = seatIndex;
    }

    // Check if bidding round is complete (all 4 players declared)
    const allFinished = nextPlayers.every(p => p.isBiddingFinished);

    if (allFinished) {
      // If nobody bid in İhale, default to first player with 4
      if (nextBidWinner === null) {
        nextBidWinner = (table.dealerSeat + 1) % 4;
        nextHighestBid = 4;
        nextPlayers[nextBidWinner].bid = 4;
      }

      if (table.gameMode === 'koz_maca') {
        // Koz Maça: Trump is always Spades, start playing
        const newTable: BatakState = {
          ...table,
          phase: 'PLAYING',
          players: nextPlayers,
          bidWinnerSeat: nextBidWinner,
          highestBid: nextHighestBid,
          trumpSuit: 'spades',
          turnSeatIndex: nextBidWinner
        };
        broadcastTable(newTable);
        showBanner(`İhale tamamlandı. Koz: ♠ Maça. ${table.players[nextBidWinner].username} eli açıyor!`, 'trump');
      } else {
        // İhaleli: Winner selects trump
        const newTable: BatakState = {
          ...table,
          phase: 'TRUMP_SELECTION',
          players: nextPlayers,
          bidWinnerSeat: nextBidWinner,
          highestBid: nextHighestBid,
          turnSeatIndex: nextBidWinner
        };
        broadcastTable(newTable);
        showBanner(`İhaleyi ${nextHighestBid} ile ${nextPlayers[nextBidWinner].username} kazandı! Koz seçiliyor...`, 'win');
      }
    } else {
      // Move to next bidder
      const nextTurn = (seatIndex + 1) % 4;
      const newTable: BatakState = {
        ...table,
        players: nextPlayers,
        highestBid: nextHighestBid,
        bidWinnerSeat: nextBidWinner,
        turnSeatIndex: nextTurn
      };
      broadcastTable(newTable);
    }
  };

  // --- Trump Selection ---
  const handleSelectTrump = (suit: Suit) => {
    const winnerSeat = table.bidWinnerSeat!;
    const newTable: BatakState = {
      ...table,
      phase: 'PLAYING',
      trumpSuit: suit,
      turnSeatIndex: winnerSeat
    };
    broadcastTable(newTable);
    showBanner(`Koz: ${SUIT_SYMBOLS[suit]} ${SUIT_NAMES_TR[suit]} olarak belirlendi! İlk kartı atın.`, 'trump');
  };

  // --- Play Card ---
  const handlePlayCard = (seatIndex: number, card: Card) => {
    if (table.phase !== 'PLAYING' || table.turnSeatIndex !== seatIndex) return;

    const nextPlayers = [...table.players];
    const player = nextPlayers[seatIndex];
    if (!player) return;

    // Check legality
    const validCards = getValidBatakCards(player.hand, table.currentTrick, table.trumpSuit!, table.isTrumpBroken);
    const isValid = validCards.some(c => c.suit === card.suit && c.rank === card.rank);
    if (!isValid) {
      if (player.userId === currentUserId) {
        showBanner('Kural hatası: Bu kartı atamazsınız!', 'lose');
      }
      return;
    }

    // Remove card from player hand
    const nextHand = player.hand.filter(c => !(c.suit === card.suit && c.rank === card.rank));
    nextPlayers[seatIndex] = { ...player, hand: nextHand };

    const playedEntry: PlayedCard = { seatIndex, card, timestamp: Date.now() };
    const nextTrick = [...table.currentTrick, playedEntry];

    // Check if trump is broken (played as ruff on different lead suit)
    let nextTrumpBroken = table.isTrumpBroken;
    if (card.suit === table.trumpSuit) {
      nextTrumpBroken = true;
    }

    if (nextTrick.length === 4) {
      // 4 cards played -> Trick end
      const trickEval = evaluateTrickWinner(nextTrick, table.trumpSuit!);
      const newTable: BatakState = {
        ...table,
        phase: 'TRICK_END',
        players: nextPlayers,
        currentTrick: nextTrick,
        isTrumpBroken: nextTrumpBroken,
        trickWinnerSeat: trickEval.winnerSeat
      };
      broadcastTable(newTable);
    } else {
      // Advance to next player
      const nextTurn = (seatIndex + 1) % 4;
      const newTable: BatakState = {
        ...table,
        players: nextPlayers,
        currentTrick: nextTrick,
        isTrumpBroken: nextTrumpBroken,
        turnSeatIndex: nextTurn
      };
      broadcastTable(newTable);
    }
  };

  // --- Resolve Trick End ---
  const resolveTrickEnd = () => {
    const trickWinnerSeat = table.trickWinnerSeat!;
    const nextPlayers = [...table.players];
    nextPlayers[trickWinnerSeat].tricksWon += 1;

    const nextTricksHistory = [...table.tricksHistory, { winnerSeat: trickWinnerSeat, trick: table.currentTrick }];

    // Check if round finished (all 13 tricks played)
    const isRoundOver = nextPlayers[0].hand.length === 0;

    if (isRoundOver) {
      // Calculate round scores
      const bids = nextPlayers.map(p => p.bid);
      const tricks = nextPlayers.map(p => p.tricksWon);
      const roundScoreList: number[] = [];

      for (let i = 0; i < 4; i++) {
        const p = nextPlayers[i];
        let pScore = 0;
        if (i === table.bidWinnerSeat) {
          // Contractor
          if (p.tricksWon >= p.bid) {
            pScore = p.tricksWon * 10;
          } else {
            pScore = -(p.bid * 10); // BATTİ
          }
        } else {
          // Defender
          if (p.tricksWon === 0) {
            pScore = -50; // Zero tricks penalty
          } else {
            pScore = p.tricksWon * 10;
          }
        }
        p.score = pScore;
        p.totalScore += pScore;
        roundScoreList.push(pScore);
      }

      const nextRoundScores = [
        ...table.roundScores,
        { round: table.currentRound, bids, tricks, scores: roundScoreList }
      ];

      const newTable: BatakState = {
        ...table,
        phase: 'ROUND_SCORE',
        players: nextPlayers,
        currentTrick: [],
        tricksHistory: nextTricksHistory,
        roundScores: nextRoundScores
      };
      broadcastTable(newTable);
      setShowScoreModal(true);
    } else {
      // Next trick, winner leads!
      const newTable: BatakState = {
        ...table,
        phase: 'PLAYING',
        players: nextPlayers,
        currentTrick: [],
        turnSeatIndex: trickWinnerSeat,
        trickWinnerSeat: null
      };
      broadcastTable(newTable);
    }
  };

  // --- Next Round Deal ---
  const handleStartNextRound = () => {
    const [h0, h1, h2, h3] = dealBatakHands();
    const nextDealer = (table.dealerSeat + 1) % 4;

    const nextPlayers = table.players.map((p, idx) => ({
      ...p,
      hand: idx === 0 ? h0 : idx === 1 ? h1 : idx === 2 ? h2 : h3,
      bid: -1,
      tricksWon: 0,
      score: 0,
      isBiddingFinished: false
    }));

    const newTable: BatakState = {
      ...table,
      currentRound: table.currentRound + 1,
      phase: 'BIDDING',
      players: nextPlayers,
      dealerSeat: nextDealer,
      bidWinnerSeat: null,
      highestBid: table.gameMode === 'ihale' ? 4 : 0,
      trumpSuit: table.gameMode === 'koz_maca' ? 'spades' : null,
      isTrumpBroken: false,
      currentTrick: [],
      turnSeatIndex: (nextDealer + 1) % 4,
      trickWinnerSeat: null,
      tricksHistory: []
    };

    setShowScoreModal(false);
    broadcastTable(newTable);
  };

  // Local user's legal cards
  const myValidCards = table.phase === 'PLAYING' && table.turnSeatIndex === mySeatIndex
    ? getValidBatakCards(myPlayer.hand, table.currentTrick, table.trumpSuit, table.isTrumpBroken)
    : [];

  const isMyTurnToBid = table.phase === 'BIDDING' && table.turnSeatIndex === mySeatIndex && !myPlayer.isBiddingFinished;
  const isMyTurnToTrump = table.phase === 'TRUMP_SELECTION' && table.bidWinnerSeat === mySeatIndex;
  const isMyTurnToPlay = table.phase === 'PLAYING' && table.turnSeatIndex === mySeatIndex;

  // Relative seat mapping (0: South/Me, 1: West, 2: North, 3: East)
  const getPlayerAtPos = (pos: 'south' | 'west' | 'north' | 'east'): BatakPlayer => {
    const offset = pos === 'south' ? 0 : pos === 'west' ? 1 : pos === 'north' ? 2 : 3;
    const targetIndex = (mySeatIndex + offset) % 4;
    return table.players[targetIndex];
  };

  const southPlayer = getPlayerAtPos('south');
  const westPlayer = getPlayerAtPos('west');
  const northPlayer = getPlayerAtPos('north');
  const eastPlayer = getPlayerAtPos('east');

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-950 text-slate-100 select-none overflow-hidden relative">
      
      {/* --- Top Navigation & HUD --- */}
      <div className="px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-emerald-500/20 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHub}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Lobiden Çık</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-xl">♠️</span>
            <div>
              <h1 className="text-sm sm:text-base font-black text-emerald-400 tracking-tight flex items-center gap-2">
                {table.gameMode === 'ihale' ? 'İhaleli Batak' : 'Koz Maça Batak'}
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  El: {table.currentRound}/{table.targetRounds}
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">
                {table.trumpSuit ? `Koz: ${SUIT_SYMBOLS[table.trumpSuit]} ${SUIT_NAMES_TR[table.trumpSuit]}` : 'İhale Aşaması'} • İhale: {table.highestBid > 0 ? `${table.highestBid} (${table.players[table.bidWinnerSeat || 0]?.username})` : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-2">
          {/* Emirgan Special Virtual Chip Control Button */}
          {isEmirgan && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md animate-pulse cursor-pointer"
              title="Emirgan Sanal Bakiye Yönetimi"
            >
              <Zap size={14} />
              <span className="hidden md:inline">Bakiye Yönet</span>
            </button>
          )}

          <button
            onClick={() => setShowScoreModal(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700"
          >
            <Trophy size={14} className="text-amber-400" />
            <span>Skor Tablosu</span>
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Batak Kuralları"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* --- Banner Notification --- */}
      {bannerMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className={`px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm shadow-2xl border flex items-center gap-2 ${
            bannerMessage.type === 'win'
              ? 'bg-emerald-600 text-white border-emerald-400'
              : bannerMessage.type === 'trump'
              ? 'bg-amber-600 text-white border-amber-400'
              : bannerMessage.type === 'lose'
              ? 'bg-rose-700 text-white border-rose-500'
              : 'bg-slate-800 text-white border-slate-600'
          }`}>
            <span>{bannerMessage.text}</span>
          </div>
        </div>
      )}

      {/* --- Felt Batak Table Canvas --- */}
      <div 
        className="flex-1 flex flex-col justify-between p-2 sm:p-4 overflow-hidden relative"
        style={{
          background: 'radial-gradient(ellipse at center, #064e3b 0%, #022c22 60%, #021a14 100%)'
        }}
      >
        {/* Table Felt Accent Ring */}
        <div className="absolute inset-4 sm:inset-10 border-2 border-emerald-400/20 rounded-[100px] pointer-events-none" />

        {/* --- Top: North Player --- */}
        <div className="flex flex-col items-center justify-center relative z-10">
          <div className={`px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-lg transition-all ${
            table.turnSeatIndex === northPlayer.seatIndex
              ? 'bg-amber-950/90 border-2 border-amber-400 ring-4 ring-amber-400/30'
              : 'bg-black/60 border border-emerald-500/30'
          }`}>
            <Avatar
              url={northPlayer.avatar}
              name={northPlayer.username}
              color={northPlayer.color || undefined}
              size={6}
            />
            <div className="text-left">
              <span className="text-xs font-black text-slate-100 block">{northPlayer.username}</span>
              <span className="text-[10px] text-emerald-400 font-bold">
                İhale: {northPlayer.bid > 0 ? northPlayer.bid : northPlayer.bid === 0 ? 'Pas' : '-'} • Aldığı: {northPlayer.tricksWon}
              </span>
            </div>
          </div>
          {/* North Hand Backs */}
          <div className="flex items-center -space-x-4 sm:-space-x-5 mt-1">
            {northPlayer.hand.map((_, i) => (
              <PlayingCard key={i} faceDown size="xs" />
            ))}
          </div>
        </div>

        {/* --- Middle: West & East Players + Center Trick Area --- */}
        <div className="flex items-center justify-between px-2 sm:px-6 my-auto relative z-10">
          
          {/* West Player */}
          <div className="flex flex-col items-center">
            <div className={`px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-lg mb-1 transition-all ${
              table.turnSeatIndex === westPlayer.seatIndex
                ? 'bg-amber-950/90 border-2 border-amber-400 ring-4 ring-amber-400/30'
                : 'bg-black/60 border border-emerald-500/30'
            }`}>
              <Avatar
                url={westPlayer.avatar}
                name={westPlayer.username}
                color={westPlayer.color || undefined}
                size={6}
              />
              <div className="text-left">
                <span className="text-xs font-black text-slate-100 block">{westPlayer.username}</span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  İhale: {westPlayer.bid > 0 ? westPlayer.bid : westPlayer.bid === 0 ? 'Pas' : '-'} • Aldığı: {westPlayer.tricksWon}
                </span>
              </div>
            </div>
            {/* West Hand Backs (Vertical Stack) */}
            <div className="flex flex-col -space-y-8">
              {westPlayer.hand.slice(0, 10).map((_, i) => (
                <PlayingCard key={i} faceDown size="xs" />
              ))}
            </div>
          </div>

          {/* Center Trick Play Field */}
          <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-full border-2 border-dashed border-emerald-400/30 flex items-center justify-center bg-black/30 backdrop-blur-sm shadow-inner">
            {/* Trump & Lead Suit watermark */}
            {table.trumpSuit && (
              <div className="absolute inset-0 flex flex-col items-center justify-center opacity-15 pointer-events-none">
                <span className="text-6xl font-black text-emerald-300">
                  {SUIT_SYMBOLS[table.trumpSuit]}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                  KOZ {SUIT_NAMES_TR[table.trumpSuit]}
                </span>
              </div>
            )}

            {/* Played Cards on the Table */}
            {table.currentTrick.map((play) => {
              const seatOffset = (play.seatIndex - mySeatIndex + 4) % 4;
              const posStyles = [
                'bottom-2 left-1/2 -translate-x-1/2', // 0: South
                'left-2 top-1/2 -translate-y-1/2',    // 1: West
                'top-2 left-1/2 -translate-x-1/2',    // 2: North
                'right-2 top-1/2 -translate-y-1/2'    // 3: East
              ][seatOffset];

              const isWinning = table.trickWinnerSeat === play.seatIndex;

              return (
                <div key={play.seatIndex} className={`absolute ${posStyles} transition-all duration-300 transform`}>
                  <PlayingCard
                    card={play.card}
                    size="sm"
                    glow={isWinning ? 'emerald' : 'none'}
                    className={`shadow-xl ${isWinning ? 'ring-4 ring-emerald-400 scale-110' : ''}`}
                  />
                  <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-slate-300 bg-black/80 px-1.5 rounded whitespace-nowrap">
                    {table.players[play.seatIndex].username}
                  </span>
                </div>
              );
            })}
          </div>

          {/* East Player */}
          <div className="flex flex-col items-center">
            <div className={`px-3 py-1.5 rounded-2xl flex items-center gap-2 shadow-lg mb-1 transition-all ${
              table.turnSeatIndex === eastPlayer.seatIndex
                ? 'bg-amber-950/90 border-2 border-amber-400 ring-4 ring-amber-400/30'
                : 'bg-black/60 border border-emerald-500/30'
            }`}>
              <Avatar
                url={eastPlayer.avatar}
                name={eastPlayer.username}
                color={eastPlayer.color || undefined}
                size={6}
              />
              <div className="text-left">
                <span className="text-xs font-black text-slate-100 block">{eastPlayer.username}</span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  İhale: {eastPlayer.bid > 0 ? eastPlayer.bid : eastPlayer.bid === 0 ? 'Pas' : '-'} • Aldığı: {eastPlayer.tricksWon}
                </span>
              </div>
            </div>
            {/* East Hand Backs (Vertical Stack) */}
            <div className="flex flex-col -space-y-8">
              {eastPlayer.hand.slice(0, 10).map((_, i) => (
                <PlayingCard key={i} faceDown size="xs" />
              ))}
            </div>
          </div>

        </div>

        {/* --- Bottom: South (Me / Local User) Hand Fan --- */}
        <div className="flex flex-col items-center justify-end relative z-20 pb-1">
          
          {/* My Info Bar */}
          <div className={`px-4 py-1 rounded-full flex items-center gap-3 mb-1 shadow-md transition-all ${
            isMyTurnToPlay || isMyTurnToBid || isMyTurnToTrump
              ? 'bg-amber-500 text-slate-950 font-black ring-4 ring-amber-400/40 animate-pulse'
              : 'bg-black/70 border border-emerald-500/40 text-emerald-400 font-bold'
          }`}>
            <span className="text-xs">{southPlayer.username} (Sen)</span>
            <span className="text-xs opacity-90">
              İhale: {southPlayer.bid > 0 ? southPlayer.bid : southPlayer.bid === 0 ? 'Pas' : '-'} • Aldığın El: {southPlayer.tricksWon}
            </span>
          </div>

          {/* Cards Fan (Overlapping Responsive Hand) */}
          <div className="flex items-end justify-center -space-x-5 sm:-space-x-6 md:-space-x-4 max-w-full overflow-x-visible py-2 px-4">
            {southPlayer.hand.map((card, idx) => {
              const isPlayable = isMyTurnToPlay && myValidCards.some(c => c.suit === card.suit && c.rank === card.rank);
              const isDisabled = isMyTurnToPlay && !isPlayable;

              return (
                <PlayingCard
                  key={card.id || idx}
                  card={card}
                  size="md"
                  isPlayable={isPlayable}
                  isDisabled={isDisabled}
                  isSelected={isPlayable}
                  onClick={() => isPlayable && handlePlayCard(mySeatIndex, card)}
                  className="transition-all transform hover:z-30 shadow-2xl"
                />
              );
            })}
          </div>
        </div>

      </div>

      {/* --- Interactive Bidding Modal --- */}
      {isMyTurnToBid && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="text-center">
              <span className="text-3xl">♠️</span>
              <h3 className="text-lg font-black text-amber-400 mt-1">İhale Sırası Sende!</h3>
              <p className="text-xs text-slate-400">
                Mevcut en yüksek ihale: <strong className="text-white">{table.highestBid > 0 ? table.highestBid : 'Henüz Yok'}</strong>
              </p>
            </div>

            {/* Bid Numbers Selector */}
            <div className="grid grid-cols-4 gap-2">
              {[5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                const canBid = num > table.highestBid;
                return (
                  <button
                    key={num}
                    disabled={!canBid}
                    onClick={() => setSelectedBid(num)}
                    className={`py-3 rounded-xl font-black text-sm transition-all ${
                      selectedBid === num && canBid
                        ? 'bg-amber-500 text-slate-950 ring-4 ring-amber-400/50 scale-105'
                        : canBid
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                        : 'bg-slate-800/40 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    {num} El
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => handlePlayerBid(mySeatIndex, 0)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-black text-xs transition-colors"
              >
                PAS GEÇ
              </button>
              <button
                onClick={() => handlePlayerBid(mySeatIndex, selectedBid)}
                disabled={selectedBid <= table.highestBid}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs transition-colors shadow-lg shadow-emerald-900/30"
              >
                {selectedBid} İLE GİR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Interactive Trump Selection Modal --- */}
      {isMyTurnToTrump && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-emerald-500/60 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 text-center">
            <div>
              <span className="text-3xl">👑</span>
              <h3 className="text-lg font-black text-emerald-400 mt-1">İhaleyi Kazandınız!</h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Lütfen bu elin <strong>Koz Rengini</strong> seçin:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]).map((suit) => {
                const isRed = suit === 'hearts' || suit === 'diamonds';
                return (
                  <button
                    key={suit}
                    onClick={() => handleSelectTrump(suit)}
                    className="py-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500 flex flex-col items-center justify-center gap-1 transition-all transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg"
                  >
                    <span className={`text-3xl font-black ${isRed ? 'text-rose-500' : 'text-slate-100'}`}>
                      {SUIT_SYMBOLS[suit]}
                    </span>
                    <span className="text-xs font-black text-slate-300">
                      {SUIT_NAMES_TR[suit]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- Scoreboard Modal --- */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-400 flex items-center gap-2">
                <Trophy size={20} /> Batak Skor Tablosu
              </h3>
              <button
                onClick={() => setShowScoreModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Players Scores Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2">Oyuncu</th>
                    <th className="py-2 text-center">İhale</th>
                    <th className="py-2 text-center">Aldığı</th>
                    <th className="py-2 text-center">El Puanı</th>
                    <th className="py-2 text-right">Toplam Skor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {table.players.map((p) => {
                    const isBatti = p.seatIndex === table.bidWinnerSeat && p.tricksWon < p.bid;
                    return (
                      <tr key={p.seatIndex} className={p.userId === currentUserId ? 'bg-emerald-950/30' : ''}>
                        <td className="py-2.5 font-bold flex items-center gap-2">
                          <Avatar url={p.avatar} name={p.username} color={p.color || undefined} size={5} />
                          <span>{p.username}</span>
                        </td>
                        <td className="py-2.5 text-center font-bold text-slate-300">{p.bid > 0 ? p.bid : 'Pas'}</td>
                        <td className="py-2.5 text-center font-bold text-slate-300">{p.tricksWon}</td>
                        <td className="py-2.5 text-center font-black">
                          {isBatti ? (
                            <span className="text-rose-400 font-extrabold">{p.score} (BATTI)</span>
                          ) : (
                            <span className="text-emerald-400">+{p.score}</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right font-black text-amber-400 text-sm">{p.totalScore}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action */}
            {table.phase === 'ROUND_SCORE' && isHost && (
              <button
                onClick={handleStartNextRound}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} /> SONRAKİ ELE GEÇ ({table.currentRound + 1}/{table.targetRounds})
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Rules Modal --- */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-emerald-400 flex items-center gap-2">
                <span>♠️</span> Batak Oyun Kuralları
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p><strong>Amaç:</strong> İhalede taahhüt edilen el sayısına ulaşmak ve rakipleri batırmaktır.</p>
              <p><strong>Koz Çıkması Kuralı:</strong> Yere daha önce hiç koz oynanmadıysa, elinizde başka renkte kart varken kozla oyunu açamazsınız.</p>
              <p><strong>Renge Uyma & Büyütme:</strong> Yere atılan renkten kartınız varsa o rengi atmak ve yerdeki en büyük karttan daha büyüğü varsa büyütmek (üste çıkmak) zorundasınız.</p>
              <p><strong>Koz Çakma:</strong> Yerdeki renkten kartınız yoksa ve elinizde koz varsa, koz çakmak zorundasınız.</p>
              <p><strong>Puanlama:</strong> İhaleyi alan taahhüt ettiği eli alırsa `Aldığı x 10`, alamazsa `- (İhale x 10)` ceza puanı alır. Diğer oyuncular 0 çekerse ceza yer, el alırlarsa `Aldığı x 10` puan kazanırlar.</p>
            </div>
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition-colors"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

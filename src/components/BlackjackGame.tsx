import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  ArrowLeft, Users, Bot, Plus, RefreshCw, Shield, Sparkles, Trophy, 
  HelpCircle, Settings, Play, Flame, DollarSign, X, Check, Volume2, VolumeX,
  Coins, Clock, Zap, Link2, Lock, KeyRound, Copy
} from 'lucide-react';
import PlayingCard, { Card } from './PlayingCard';
import Avatar from './Avatar';
import AdminChipManagerModal from './AdminChipManagerModal';
import { 
  BlackjackState, BlackjackSeat, BlackjackHand, HandResult,
  calculateHandScore, formatScoreDisplay, decideBotAction, 
  drawCard, initializeBlackjackTable 
} from '../utils/blackjackEngine';
import { CreateTableOptions } from './CardTableLobbyModal';
import { getApiUrl } from '../utils/api';

interface BlackjackGameProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  tableId?: string | null;
  tableOptions?: CreateTableOptions | null;
  initialChips?: number;
  onBackToHub: () => void;
}

const BOT_NAMES = ['Bot Can', 'Bot Selin', 'Bot Mert', 'Bot Zeynep', 'Bot Kaan', 'Bot Emre'];

// Promise-based precision pacing delay
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function BlackjackGame({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  tableId,
  tableOptions,
  initialChips = 1000,
  onBackToHub
}: BlackjackGameProps) {
  const [currentUserChips, setCurrentUserChips] = useState<number>(initialChips);

  // Local state holding the full table state
  const [table, setTable] = useState<BlackjackState>(() => {
    const minBet = tableOptions?.minBet || 50;
    const maxBet = tableOptions?.maxBet || 2500;
    const minBalance = tableOptions?.minBalance || 0;
    const title = tableOptions?.title || `${username}'in Masası`;
    const isPrivate = Boolean(tableOptions?.isPrivate);
    const passcode = tableOptions?.passcode;

    return initializeBlackjackTable(
      tableId || `bj_${Date.now()}`,
      title,
      currentUserId,
      username,
      avatar,
      color,
      initialChips,
      minBet,
      maxBet,
      minBalance,
      isPrivate,
      passcode
    );
  });

  const [selectedBetChip, setSelectedBetChip] = useState<number>(table.minBet || 50);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [bannerMessage, setBannerMessage] = useState<{ text: string; type: 'win' | 'lose' | 'bj' | 'push' | 'info' } | null>(null);

  // Pacing & Action Locks
  const [isDealing, setIsDealing] = useState<boolean>(false);
  const [isDealerPlaying, setIsDealerPlaying] = useState<boolean>(false);
  const [botThinkingSeat, setBotThinkingSeat] = useState<number | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  const isHost = table.hostId === currentUserId;
  const isEmirgan = username?.toLowerCase().trim() === 'emirgan';
  const mySeat = table.seats.find((s) => s && s.userId === currentUserId) || null;
  const mySeatIndex = mySeat ? mySeat.seatIndex : -1;

  // Banner message helper
  const showBanner = (text: string, type: 'win' | 'lose' | 'bj' | 'push' | 'info' = 'info', duration = 3500) => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), duration);
  };

  // --- Fetch User's Real DB Chips on Mount ---
  useEffect(() => {
    const token = localStorage.getItem('lan_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    fetch(getApiUrl('/api/leaderboard?type=chips'), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const me = data.find((u: any) => u.id === currentUserId);
          if (me && me.chips !== undefined) {
            const dbChips = Number(me.chips);
            setCurrentUserChips(dbChips);
            setTable((prev) => ({
              ...prev,
              seats: prev.seats.map((s) => (s && s.userId === currentUserId ? { ...s, chips: dbChips } : s))
            }));
          }
        }
      })
      .catch(() => {});
  }, [currentUserId]);

  // --- Socket.io Multiplayer Sync & Balance Tracking ---
  useEffect(() => {
    if (!socket) return;

    const onTableState = (syncedTable: BlackjackState) => {
      if (syncedTable && syncedTable.id === table.id) {
        setTable(syncedTable);
      }
    };

    const onChipsUpdated = (data: { userId: number; chips: number; message?: string }) => {
      if (!data) return;
      const newChips = Number(data.chips);
      
      setTable((prev) => ({
        ...prev,
        seats: prev.seats.map((s) => (s && s.userId === data.userId ? { ...s, chips: newChips } : s))
      }));

      if (data.userId === currentUserId) {
        setCurrentUserChips(newChips);
        if (data.message) {
          showBanner(data.message, 'win', 4000);
        }
      }
    };

    socket.on('blackjack_state', onTableState);
    socket.on('chips_updated', onChipsUpdated);
    socket.emit('get_blackjack_state', { tableId: table.id });

    return () => {
      socket.off('blackjack_state', onTableState);
      socket.off('chips_updated', onChipsUpdated);
    };
  }, [socket, table.id, currentUserId]);

  // Sync state to socket
  const broadcastTable = useCallback((newTable: BlackjackState) => {
    setTable(newTable);
    if (socket && socket.connected) {
      socket.emit('blackjack_update_state', newTable);
    }
  }, [socket]);

  // Copy table share link to clipboard
  const handleCopyTableLink = () => {
    const shareUrl = `${window.location.origin}/games/blackjack?table=${table.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showBanner(`Masa bağlantısı panoya kopyalandı! Arkadaşına göndererek davet edebilirsin. 📋`, 'info', 4000);
    }).catch(() => {
      showBanner(`Masa ID: ${table.id} kopyalandı!`, 'info', 3000);
    });
  };

  // --- Bot / Turn Runner Engine with Realistic Pacing ---
  useEffect(() => {
    if (!isHost || isDealing || isDealerPlaying) return;

    let timer: NodeJS.Timeout | null = null;

    // Phase 1: If in BETTING and bots need to bet
    if (table.phase === 'BETTING') {
      const botsWithoutBets = table.seats.filter((s) => s && s.isBot && (!s.hands[0] || s.hands[0].bet === 0));
      if (botsWithoutBets.length > 0) {
        timer = setTimeout(() => {
          setTable((prev) => {
            const nextSeats = prev.seats.map((s) => {
              if (!s || !s.isBot) return s;
              const bet = Math.min(s.chips, Math.max(prev.minBet, [table.minBet, table.minBet * 2, table.minBet * 4][Math.floor(Math.random() * 3)]));
              return {
                ...s,
                hands: [{
                  cards: [],
                  bet,
                  result: 'PLAYING' as HandResult,
                  isDouble: false,
                  isSplit: false,
                  score: 0,
                  isSoft: false,
                  payout: 0
                }],
                isReady: true
              };
            });
            return { ...prev, seats: nextSeats };
          });
        }, 600);
      }
    }

    // Phase 2: If in PLAYER_TURNS and current active seat is a BOT
    if (table.phase === 'PLAYER_TURNS' && table.activeSeatIndex >= 0) {
      const currentSeat = table.seats[table.activeSeatIndex];
      if (currentSeat && currentSeat.isBot) {
        const currentHand = currentSeat.hands[currentSeat.activeHandIndex];
        if (currentHand && currentHand.result === 'PLAYING') {
          setBotThinkingSeat(table.activeSeatIndex);
          timer = setTimeout(() => {
            setBotThinkingSeat(null);
            const dealerUpCard = table.dealer.cards[0] || null;
            const canDouble = currentHand.cards.length === 2 && currentSeat.chips >= currentHand.bet;
            const canSplit = currentHand.cards.length === 2 && 
              currentHand.cards[0].rank === currentHand.cards[1].rank && 
              currentSeat.chips >= currentHand.bet;

            const decision = decideBotAction(currentHand, dealerUpCard, canDouble, canSplit, currentSeat.chips);

            if (decision === 'hit') {
              handleHit(table.activeSeatIndex);
            } else if (decision === 'double') {
              handleDouble(table.activeSeatIndex);
            } else if (decision === 'split') {
              handleSplit(table.activeSeatIndex);
            } else {
              handleStand(table.activeSeatIndex);
            }
          }, 850);
        } else {
          // If bot hand already stood or busted, advance turn
          advanceToNextHandOrPlayer(table.activeSeatIndex);
        }
      }
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [table, isHost, isDealing, isDealerPlaying]);

  // Advance to next active seat or dealer turn
  const advanceToNextHandOrPlayer = (currentSeatIdx: number) => {
    const seat = table.seats[currentSeatIdx];
    if (seat && seat.activeHandIndex < seat.hands.length - 1) {
      const nextSeats = [...table.seats];
      nextSeats[currentSeatIdx] = {
        ...seat,
        activeHandIndex: seat.activeHandIndex + 1
      };
      const nextTable = { ...table, seats: nextSeats };
      broadcastTable(nextTable);
      return;
    }

    let nextSeatIdx = -1;
    for (let i = currentSeatIdx + 1; i < table.seats.length; i++) {
      const s = table.seats[i];
      if (s && s.hands.length > 0 && s.hands.some((h) => h.result === 'PLAYING')) {
        nextSeatIdx = i;
        break;
      }
    }

    if (nextSeatIdx !== -1) {
      const nextTable: BlackjackState = {
        ...table,
        activeSeatIndex: nextSeatIdx,
        turnExpiresAt: Date.now() + table.turnTimeLimit * 1000
      };
      broadcastTable(nextTable);
    } else {
      // All players finished -> Dealer's turn!
      const nextTable: BlackjackState = {
        ...table,
        phase: 'DEALER_TURN',
        activeSeatIndex: -1
      };
      broadcastTable(nextTable);
      playDealerTurn();
    }
  };

  // --- Betting Phase Controls ---
  const handlePlaceBet = (amount: number) => {
    if (table.phase !== 'BETTING' || isDealing) return;
    if (mySeatIndex === -1) {
      showBanner('Bahis koymak için lütfen önce boş bir koltuğa oturun!', 'info');
      return;
    }

    const currentSeat = table.seats[mySeatIndex];
    if (!currentSeat) return;

    const currentBet = currentSeat.hands[0]?.bet || 0;
    const newBet = currentBet + amount;

    if (newBet > currentSeat.chips) {
      showBanner('Yetersiz sanal bakiye!', 'lose');
      return;
    }

    if (table.maxBet && table.maxBet > 0 && newBet > table.maxBet) {
      showBanner(`Maksimum bahis limiti ${table.maxBet.toLocaleString()}$`, 'lose');
      return;
    }

    const nextSeats = [...table.seats];
    nextSeats[mySeatIndex] = {
      ...currentSeat,
      hands: [{
        cards: [],
        bet: newBet,
        result: 'PLAYING',
        isDouble: false,
        isSplit: false,
        score: 0,
        isSoft: false,
        payout: 0
      }],
      isReady: true
    };

    const nextTable: BlackjackState = { ...table, seats: nextSeats };
    broadcastTable(nextTable);
  };

  const handleClearBet = () => {
    if (table.phase !== 'BETTING' || isDealing || mySeatIndex === -1) return;
    const currentSeat = table.seats[mySeatIndex];
    if (!currentSeat) return;

    const nextSeats = [...table.seats];
    nextSeats[mySeatIndex] = {
      ...currentSeat,
      hands: [],
      isReady: false
    };

    const nextTable: BlackjackState = { ...table, seats: nextSeats };
    broadcastTable(nextTable);
  };

  const handleAllIn = () => {
    if (table.phase !== 'BETTING' || isDealing || mySeatIndex === -1) return;
    const currentSeat = table.seats[mySeatIndex];
    if (!currentSeat || currentSeat.chips <= 0) return;

    let allInAmount = currentSeat.chips;
    if (table.maxBet && table.maxBet > 0 && allInAmount > table.maxBet) {
      allInAmount = table.maxBet;
    }

    const nextSeats = [...table.seats];
    nextSeats[mySeatIndex] = {
      ...currentSeat,
      hands: [{
        cards: [],
        bet: allInAmount,
        result: 'PLAYING',
        isDouble: false,
        isSplit: false,
        score: 0,
        isSoft: false,
        payout: 0
      }],
      isReady: true
    };

    const nextTable: BlackjackState = { ...table, seats: nextSeats };
    broadcastTable(nextTable);
    showBanner(`ALL-IN! ${allInAmount.toLocaleString()} 🪙`, 'bj');
  };

  // --- Initial Paced Deal (400ms sequential per player card, 600ms for dealer cards) ---
  const handleStartDeal = async () => {
    if (!isHost || table.phase !== 'BETTING' || isDealing) return;

    const seatedWithBets = table.seats.filter((s) => s && s.hands[0] && s.hands[0].bet >= table.minBet);
    if (seatedWithBets.length === 0) {
      showBanner(`En az bir oyuncunun minimum ${table.minBet}$ bahis koyması gerekmektedir!`, 'lose');
      return;
    }

    setIsDealing(true);

    let shoe = [...table.shoe];
    const nextSeats = [...table.seats];

    // Deduct placed bets from chips
    for (let i = 0; i < nextSeats.length; i++) {
      const s = nextSeats[i];
      if (s && s.hands[0] && s.hands[0].bet > 0) {
        nextSeats[i] = {
          ...s,
          chips: Math.max(0, s.chips - s.hands[0].bet),
          hands: [{
            ...s.hands[0],
            cards: [],
            result: 'PLAYING',
            score: 0
          }]
        };
      }
    }

    let nextTable: BlackjackState = {
      ...table,
      phase: 'DEALING',
      shoe,
      seats: nextSeats,
      dealer: { cards: [], score: 0, isSoft: false, isBust: false, hasBlackjack: false }
    };
    broadcastTable(nextTable);

    // Step 1: Give 1st card to each seated player (400ms delay)
    for (let i = 0; i < nextSeats.length; i++) {
      const s = nextSeats[i];
      if (s && s.hands[0] && s.hands[0].bet > 0) {
        const draw = drawCard(shoe);
        shoe = draw.remainingShoe;
        s.hands[0].cards.push(draw.card);
        const { score, isSoft } = calculateHandScore(s.hands[0].cards);
        s.hands[0].score = score;
        s.hands[0].isSoft = isSoft;
        nextTable = { ...nextTable, shoe, seats: [...nextSeats] };
        setTable(nextTable);
        await wait(400);
      }
    }

    // Step 2: Give 1st UP card to Dealer (600ms delay)
    const dDraw1 = drawCard(shoe);
    shoe = dDraw1.remainingShoe;
    const dealerCards: Card[] = [dDraw1.card];
    const dScore1 = calculateHandScore(dealerCards);
    nextTable = {
      ...nextTable,
      shoe,
      dealer: {
        cards: dealerCards,
        score: dScore1.score,
        isSoft: dScore1.isSoft,
        isBust: false,
        hasBlackjack: false
      }
    };
    setTable(nextTable);
    await wait(600);

    // Step 3: Give 2nd card to each player (400ms delay)
    for (let i = 0; i < nextSeats.length; i++) {
      const s = nextSeats[i];
      if (s && s.hands[0] && s.hands[0].bet > 0) {
        const draw = drawCard(shoe);
        shoe = draw.remainingShoe;
        s.hands[0].cards.push(draw.card);
        const { score, isSoft, isBlackjack } = calculateHandScore(s.hands[0].cards);
        s.hands[0].score = score;
        s.hands[0].isSoft = isSoft;
        if (isBlackjack) {
          s.hands[0].result = 'BLACKJACK';
        }
        nextTable = { ...nextTable, shoe, seats: [...nextSeats] };
        setTable(nextTable);
        await wait(400);
      }
    }

    // Step 4: Give HOLE card (facedown) to Dealer (600ms delay)
    const dDraw2 = drawCard(shoe);
    shoe = dDraw2.remainingShoe;
    dealerCards.push(dDraw2.card);
    const dScoreFinal = calculateHandScore(dealerCards);
    nextTable = {
      ...nextTable,
      shoe,
      dealer: {
        cards: dealerCards,
        score: dScore1.score, // show only 1st card score during player turns
        isSoft: dScore1.isSoft,
        isBust: false,
        hasBlackjack: dScoreFinal.isBlackjack
      }
    };
    setTable(nextTable);
    await wait(600);

    // Find first active player
    let firstActiveSeat = -1;
    for (let i = 0; i < nextSeats.length; i++) {
      const s = nextSeats[i];
      if (s && s.hands[0] && s.hands[0].result === 'PLAYING') {
        firstActiveSeat = i;
        break;
      }
    }

    setIsDealing(false);

    if (firstActiveSeat !== -1) {
      nextTable = {
        ...nextTable,
        phase: 'PLAYER_TURNS',
        activeSeatIndex: firstActiveSeat,
        turnExpiresAt: Date.now() + nextTable.turnTimeLimit * 1000
      };
      broadcastTable(nextTable);
    } else {
      // All players got Blackjack! Go straight to Dealer turn
      nextTable = {
        ...nextTable,
        phase: 'DEALER_TURN',
        activeSeatIndex: -1
      };
      broadcastTable(nextTable);
      playDealerTurn();
    }
  };

  // --- Player In-Turn Actions (Hit, Stand, Double, Split) ---
  const handleHit = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;
    const seat = table.seats[seatIndex];
    if (!seat) return;
    const hand = seat.hands[seat.activeHandIndex];
    if (!hand || hand.result !== 'PLAYING') return;

    let shoe = [...table.shoe];
    const { card, remainingShoe } = drawCard(shoe);
    shoe = remainingShoe;

    const nextCards = [...hand.cards, card];
    const { score, isSoft } = calculateHandScore(nextCards);

    let nextResult: HandResult = 'PLAYING';
    if (score > 21) {
      nextResult = 'BUST';
    } else if (score === 21) {
      nextResult = 'STAND';
    }

    const nextSeats = [...table.seats];
    const nextHands = [...seat.hands];
    nextHands[seat.activeHandIndex] = {
      ...hand,
      cards: nextCards,
      score,
      isSoft,
      result: nextResult
    };

    nextSeats[seatIndex] = {
      ...seat,
      hands: nextHands
    };

    const nextTable: BlackjackState = { ...table, shoe, seats: nextSeats };
    broadcastTable(nextTable);

    if (nextResult !== 'PLAYING') {
      advanceToNextHandOrPlayer(seatIndex);
    }
  };

  const handleStand = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;
    const seat = table.seats[seatIndex];
    if (!seat) return;
    const hand = seat.hands[seat.activeHandIndex];
    if (!hand || hand.result !== 'PLAYING') return;

    const nextSeats = [...table.seats];
    const nextHands = [...seat.hands];
    nextHands[seat.activeHandIndex] = {
      ...hand,
      result: 'STAND'
    };
    nextSeats[seatIndex] = {
      ...seat,
      hands: nextHands
    };

    const nextTable: BlackjackState = { ...table, seats: nextSeats };
    broadcastTable(nextTable);
    advanceToNextHandOrPlayer(seatIndex);
  };

  const handleDouble = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;
    const seat = table.seats[seatIndex];
    if (!seat) return;
    const hand = seat.hands[seat.activeHandIndex];
    if (!hand || hand.result !== 'PLAYING' || hand.cards.length !== 2) return;
    if (seat.chips < hand.bet) {
      showBanner('Double için yetersiz çip!', 'lose');
      return;
    }

    let shoe = [...table.shoe];
    const { card, remainingShoe } = drawCard(shoe);
    shoe = remainingShoe;

    const nextCards = [...hand.cards, card];
    const { score, isSoft } = calculateHandScore(nextCards);
    const nextResult: HandResult = score > 21 ? 'BUST' : 'STAND';

    const nextSeats = [...table.seats];
    const nextHands = [...seat.hands];
    nextHands[seat.activeHandIndex] = {
      ...hand,
      cards: nextCards,
      bet: hand.bet * 2,
      score,
      isSoft,
      isDouble: true,
      result: nextResult
    };

    nextSeats[seatIndex] = {
      ...seat,
      chips: seat.chips - hand.bet,
      hands: nextHands
    };

    const nextTable: BlackjackState = { ...table, shoe, seats: nextSeats };
    broadcastTable(nextTable);
    advanceToNextHandOrPlayer(seatIndex);
  };

  const handleSplit = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;
    const seat = table.seats[seatIndex];
    if (!seat) return;
    const hand = seat.hands[seat.activeHandIndex];
    if (!hand || hand.result !== 'PLAYING' || hand.cards.length !== 2) return;
    if (hand.cards[0].rank !== hand.cards[1].rank) return;
    if (seat.chips < hand.bet) {
      showBanner('Split için yetersiz çip!', 'lose');
      return;
    }

    let shoe = [...table.shoe];
    const nextSeats = [...table.seats];

    const d1 = drawCard(shoe);
    shoe = d1.remainingShoe;
    const d2 = drawCard(shoe);
    shoe = d2.remainingShoe;

    const c1 = [hand.cards[0], d1.card];
    const c2 = [hand.cards[1], d2.card];

    const s1 = calculateHandScore(c1);
    const s2 = calculateHandScore(c2);

    const remainingChips = seat.chips - hand.bet;

    const h1: BlackjackHand = {
      cards: c1,
      bet: hand.bet,
      isDouble: false,
      isSplit: true,
      score: s1.score,
      isSoft: s1.isSoft,
      result: (s1.isBlackjack ? 'BLACKJACK' : 'PLAYING') as HandResult,
      payout: 0
    };

    const h2: BlackjackHand = {
      cards: c2,
      bet: hand.bet,
      isDouble: false,
      isSplit: true,
      score: s2.score,
      isSoft: s2.isSoft,
      result: (s2.isBlackjack ? 'BLACKJACK' : 'PLAYING') as HandResult,
      payout: 0
    };

    nextSeats[seatIndex] = {
      ...seat,
      chips: remainingChips,
      hands: [h1, h2],
      activeHandIndex: 0
    };

    const nextTable: BlackjackState = { ...table, shoe, seats: nextSeats };
    broadcastTable(nextTable);
  };

  // --- Paced Dealer Turn (1000ms pause -> Reveal hole card -> 1400ms pause -> Sequential hits) ---
  const playDealerTurn = async () => {
    setIsDealerPlaying(true);

    // Step 1: 1000ms tension pause
    await wait(1000);

    // Step 2: Reveal dealer hole card (flip)
    let shoe = [...table.shoe];
    const dealerCards = [...table.dealer.cards];
    let { score, isSoft, isBlackjack } = calculateHandScore(dealerCards);

    setTable((prev) => ({
      ...prev,
      dealer: {
        ...prev.dealer,
        score,
        isSoft,
        hasBlackjack: isBlackjack
      }
    }));

    // Step 3: 1400ms pause
    await wait(1400);

    // Step 4: Dealer Hit Loop (Draw 1 card -> calculate score -> wait 1400ms -> repeat)
    while (score < 17) {
      const draw = drawCard(shoe);
      shoe = draw.remainingShoe;
      dealerCards.push(draw.card);
      const res = calculateHandScore(dealerCards);
      score = res.score;
      isSoft = res.isSoft;

      setTable((prev) => ({
        ...prev,
        shoe,
        dealer: {
          cards: [...dealerCards],
          score,
          isSoft,
          isBust: score > 21,
          hasBlackjack: isBlackjack
        }
      }));

      await wait(1400);
    }

    const dealerBust = score > 21;
    const finalDealerState = {
      cards: dealerCards,
      score,
      isSoft,
      isBust: dealerBust,
      hasBlackjack: isBlackjack
    };

    // Step 5: 1200ms pause before payouts
    await wait(1200);

    // Step 6: Payout Evaluation & DB Persistence
    const nextSeats = [...table.seats];
    let myNetDelta = 0;

    for (let i = 0; i < nextSeats.length; i++) {
      const seat = nextSeats[i];
      if (!seat || seat.hands.length === 0) continue;

      let seatChips = seat.chips;
      const nextHands: BlackjackHand[] = [];

      for (const hand of seat.hands) {
        let result: HandResult = hand.result;
        let payout = 0;

        if (hand.result === 'BUST') {
          result = 'BUST';
          payout = 0;
        } else if (hand.result === 'BLACKJACK') {
          if (finalDealerState.hasBlackjack) {
            result = 'PUSH';
            payout = hand.bet;
          } else {
            result = 'BLACKJACK';
            payout = hand.bet + Math.floor(hand.bet * 1.5);
          }
        } else {
          if (dealerBust) {
            result = 'WIN';
            payout = hand.bet * 2;
          } else if (hand.score > score) {
            result = 'WIN';
            payout = hand.bet * 2;
          } else if (hand.score === score) {
            result = 'PUSH';
            payout = hand.bet;
          } else {
            result = 'LOSE';
            payout = 0;
          }
        }

        seatChips += payout;
        nextHands.push({ ...hand, result, payout });

        if (seat.userId === currentUserId) {
          const handDelta = payout - hand.bet;
          myNetDelta += handDelta;
        }
      }

      nextSeats[i] = {
        ...seat,
        chips: seatChips,
        hands: nextHands,
        isReady: false
      };
    }

    // Persist real DB chips for local user
    if (socket && socket.connected && myNetDelta !== 0) {
      socket.emit('update_game_chips', { delta: myNetDelta, gameType: 'blackjack' });
    }

    const roundEndTable: BlackjackState = {
      ...table,
      shoe,
      phase: 'ROUND_END',
      dealer: finalDealerState,
      seats: nextSeats
    };

    setIsDealerPlaying(false);
    broadcastTable(roundEndTable);

    // Start 5-second countdown for next round visual bar
    setCountdownSeconds(5);
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // --- Next Round Transition ---
  const handleNextRound = () => {
    if (table.phase !== 'ROUND_END') return;
    setCountdownSeconds(null);

    const nextSeats = table.seats.map((s) => {
      if (!s) return null;
      return {
        ...s,
        hands: [],
        activeHandIndex: 0,
        isReady: false,
        insuranceBet: 0,
        hasInsurance: false
      };
    });

    const nextTable: BlackjackState = {
      ...table,
      phase: 'BETTING',
      activeSeatIndex: -1,
      dealer: {
        cards: [],
        score: 0,
        isSoft: false,
        isBust: false,
        hasBlackjack: false
      },
      seats: nextSeats
    };

    broadcastTable(nextTable);
  };

  // --- Free Refill 500 Chips When Broke ---
  const handleRefillChips = async () => {
    try {
      const token = localStorage.getItem('lan_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
      const res = await fetch(getApiUrl('/api/chips/refill'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUserChips(500);
        setTable((prev) => ({
          ...prev,
          seats: prev.seats.map((s) => (s && s.userId === currentUserId ? { ...s, chips: 500 } : s))
        }));
        showBanner('500 Ücretsiz Sanal Çip Hesabınıza Eklendi! 🪙', 'win');
      } else {
        showBanner(data.error || 'Çip doldurulamadı.', 'lose');
      }
    } catch {
      showBanner('Bağlantı hatası.', 'lose');
    }
  };

  // --- Host Seat & Bot Management ---
  const handleAddBot = (seatIndex: number) => {
    if (!isHost || table.seats[seatIndex]) return;
    
    // Pick random bot name that isn't already in the table
    const currentBotNames = table.seats.filter((s) => s && s.isBot).map((s) => s!.username);
    const availableNames = BOT_NAMES.filter((n) => !currentBotNames.includes(n));
    const botName = availableNames[Math.floor(Math.random() * availableNames.length)] || `Bot ${seatIndex + 1}`;
    const botChips = Math.max(5000, (table.minBet || 50) * 40);

    const nextSeats = [...table.seats];
    nextSeats[seatIndex] = {
      seatIndex,
      username: botName,
      isBot: true,
      chips: botChips,
      hands: [],
      activeHandIndex: 0,
      insuranceBet: 0,
      hasInsurance: false,
      isReady: false
    };

    const nextTable = { ...table, seats: nextSeats };
    broadcastTable(nextTable);
    showBanner(`${botName} masaya eklendi 🤖`, 'info');
  };

  const handleRemoveSeat = (seatIndex: number) => {
    if (!isHost) return;
    const seat = table.seats[seatIndex];
    if (!seat) return;

    const nextSeats = [...table.seats];
    nextSeats[seatIndex] = null;
    const nextTable = { ...table, seats: nextSeats };
    broadcastTable(nextTable);
    showBanner(`${seat.username} masadan çıkarıldı.`, 'info');
  };

  const handleSitDown = (seatIndex: number) => {
    if (table.seats[seatIndex]) return;

    // Check minimum balance requirement if configured
    if (table.minBalance && table.minBalance > 0 && currentUserChips < table.minBalance) {
      showBanner(`Bu masaya oturmak için en az ${table.minBalance.toLocaleString()}$ sanal bakiye gereklidir!`, 'lose', 4000);
      return;
    }

    const nextSeats = table.seats.map((s) => (s && s.userId === currentUserId ? null : s));
    nextSeats[seatIndex] = {
      seatIndex,
      userId: currentUserId,
      username,
      avatar,
      color,
      isBot: false,
      chips: currentUserChips,
      hands: [],
      activeHandIndex: 0,
      insuranceBet: 0,
      hasInsurance: false,
      isReady: false
    };

    const nextTable = { ...table, seats: nextSeats };
    broadcastTable(nextTable);
    showBanner(`${seatIndex + 1}. Koltuğa oturdunuz. İyi şanslar! 🍀`, 'info');
  };

  // Determine current active hand for player
  const myCurrentHand = mySeat && mySeat.hands[mySeat.activeHandIndex];
  const isMyTurn = table.phase === 'PLAYER_TURNS' && table.activeSeatIndex === mySeatIndex && myCurrentHand?.result === 'PLAYING' && !isDealing && !isDealerPlaying;

  // Dynamic chip values for betting based on minBet
  const chipValues = [
    table.minBet || 10,
    (table.minBet || 10) * 2,
    (table.minBet || 10) * 5,
    (table.minBet || 10) * 10,
    (table.minBet || 10) * 20,
    (table.minBet || 10) * 50
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-950 text-slate-100 select-none overflow-hidden relative">
      
      {/* --- Top Navigation & HUD --- */}
      <div className="px-3 sm:px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={onBackToHub}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Lobiden Çık</span>
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-xl">🃏</span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xs sm:text-base font-black text-amber-400 tracking-tight truncate max-w-[160px] sm:max-w-xs">
                  {table.title}
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {isDealing ? 'KARTLAR DAĞITILIYOR' : isDealerPlaying ? 'KASA SIRASI' : table.phase === 'BETTING' ? 'BAHİS' : table.phase === 'PLAYER_TURNS' ? 'OYUNDA' : 'TUR SONU'}
                </span>
                {table.isPrivate && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center gap-0.5">
                    <Lock size={10} /> Özel
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Min: {table.minBet}$ • Max: {table.maxBet ? `${table.maxBet}$` : 'Limitsiz'} • {table.minBalance ? `Min Bakiye: ${table.minBalance}$` : 'Bakiye Şartsız'}
              </p>
            </div>
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Copy Table Share Link Button */}
          <button
            onClick={handleCopyTableLink}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title="Masa Linkini Kopyala (Arkadaşını Çağır)"
          >
            <Link2 size={14} />
            <span className="hidden md:inline">Masa Linki</span>
          </button>

          {/* User Chips */}
          <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm">
            <Coins size={15} className="text-amber-400" />
            <span>{(mySeat ? mySeat.chips : currentUserChips).toLocaleString()} 🪙</span>
          </div>

          {/* Free Chip Refill Button when low */}
          {(mySeat ? mySeat.chips : currentUserChips) <= 100 && (
            <button
              onClick={handleRefillChips}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1 shadow-md cursor-pointer animate-bounce"
              title="Ücretsiz 500 Çip Doldur"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">+500 Çip</span>
            </button>
          )}

          {/* Emirgan Special Virtual Chip Control Button */}
          {isEmirgan && (
            <button
              onClick={() => setShowAdminModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md cursor-pointer"
              title="Emirgan Sanal Bakiye Yönetimi"
            >
              <Zap size={14} />
              <span className="hidden md:inline">Bakiye Yönet</span>
            </button>
          )}

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Ses Aç/Kapat"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Blackjack Kuralları"
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
              : bannerMessage.type === 'bj'
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-white ring-4 ring-amber-400/50'
              : bannerMessage.type === 'lose'
              ? 'bg-rose-700 text-white border-rose-500'
              : bannerMessage.type === 'push'
              ? 'bg-amber-700 text-amber-100 border-amber-500'
              : 'bg-slate-800 text-white border-slate-600'
          }`}>
            <span>{bannerMessage.text}</span>
          </div>
        </div>
      )}

      {/* --- Casino Felt Table Canvas --- */}
      <div 
        className="flex-1 flex flex-col justify-between p-2 sm:p-4 overflow-hidden relative"
        style={{
          background: 'radial-gradient(ellipse at center, #065f46 0%, #064e3b 40%, #022c22 75%, #021a14 100%)'
        }}
      >
        {/* Table Felt Arch Lines */}
        <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-emerald-400/20 rounded-[80px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-20">
          <h2 className="text-2xl sm:text-5xl font-black tracking-widest uppercase text-emerald-300">
            BLACKJACK PAYS 3 TO 2
          </h2>
          <p className="text-[10px] sm:text-sm font-bold tracking-widest text-emerald-200 mt-1">
            DEALER MUST STAND ON 17 AND MUST DRAW TO 16
          </p>
        </div>

        {/* --- Top Dealer Area --- */}
        <div className="flex flex-col items-center justify-center pt-1 sm:pt-2 relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/30 text-xs font-black text-amber-400 flex items-center gap-1.5 shadow">
              <span>🤵 KASA (DEALER)</span>
              {table.dealer.cards.length > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 text-[10px]">
                  {formatScoreDisplay(table.dealer.cards, (table.phase === 'PLAYER_TURNS' || table.phase === 'DEALING') && !isDealerPlaying)}
                </span>
              )}
            </div>
          </div>

          {/* Dealer Cards */}
          <div className="flex items-center justify-center gap-2 min-h-[85px] sm:min-h-[110px]">
            {table.dealer.cards.length === 0 ? (
              <div className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl border-2 border-dashed border-emerald-400/30 flex items-center justify-center text-emerald-400/40 text-xs font-bold">
                Kasa
              </div>
            ) : (
              table.dealer.cards.map((card, i) => (
                <PlayingCard
                  key={card.id || i}
                  card={card}
                  faceDown={i === 1 && (table.phase === 'PLAYER_TURNS' || table.phase === 'DEALING') && !isDealerPlaying}
                  size="md"
                />
              ))
            )}
          </div>
        </div>

        {/* --- Middle 5-Seats Semicircle Layout --- */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-3 my-auto relative z-10">
          {table.seats.map((seat, seatIndex) => {
            const isCurrentTurn = table.phase === 'PLAYER_TURNS' && table.activeSeatIndex === seatIndex;
            const isMe = seat && seat.userId === currentUserId;
            const isBotThinking = botThinkingSeat === seatIndex;

            if (!seat) {
              return (
                <div 
                  key={seatIndex}
                  className="flex flex-col items-center justify-center p-2 rounded-2xl border border-dashed border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-900/30 transition-all min-h-[140px] sm:min-h-[180px]"
                >
                  <span className="text-[10px] sm:text-xs text-emerald-400/60 font-bold mb-2">Koltuk {seatIndex + 1}</span>
                  
                  <div className="flex flex-col gap-1.5 w-full max-w-[100px]">
                    {/* Sit down button */}
                    {!mySeat && (
                      <button
                        onClick={() => handleSitDown(seatIndex)}
                        disabled={isDealing || isDealerPlaying}
                        className="w-full py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] sm:text-xs flex items-center justify-center gap-1 shadow-md cursor-pointer transition-all disabled:opacity-40"
                      >
                        <Plus size={13} /> Otur
                      </button>
                    )}

                    {/* Host Add Bot Button */}
                    {isHost && (
                      <button
                        onClick={() => handleAddBot(seatIndex)}
                        disabled={isDealing || isDealerPlaying}
                        className="w-full py-1.5 px-2 rounded-xl bg-indigo-600/80 hover:bg-indigo-600 text-white font-black text-[10px] sm:text-xs flex items-center justify-center gap-1 shadow cursor-pointer transition-colors disabled:opacity-40"
                        title="Bu koltuğa yapay zeka botu ekle"
                      >
                        <Bot size={13} /> + Bot Ekle
                      </button>
                    )}

                    {mySeat && !isHost && (
                      <span className="text-[10px] text-slate-500 text-center font-bold">Boş</span>
                    )}
                  </div>
                </div>
              );
            }

            const hand = seat.hands[0];
            const hasHand = Boolean(hand && hand.cards.length > 0);

            return (
              <div
                key={seatIndex}
                className={`relative flex flex-col items-center justify-between p-1.5 sm:p-3 rounded-2xl transition-all duration-300 min-h-[145px] sm:min-h-[190px] ${
                  isCurrentTurn
                    ? 'bg-amber-950/80 border-2 border-amber-400 ring-4 ring-amber-400/30 shadow-2xl scale-105'
                    : isMe
                    ? 'bg-slate-900/90 border-2 border-emerald-400/60 shadow-lg'
                    : 'bg-black/50 border border-emerald-500/30 shadow'
                }`}
              >
                {/* Seat Header (Avatar & Username & Controls) */}
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    <Avatar
                      url={seat.avatar}
                      name={seat.username}
                      color={seat.color || undefined}
                      size={6}
                    />
                    <div className="min-w-0 truncate">
                      <span className={`text-[10px] sm:text-[11px] font-black truncate block ${isMe ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {seat.username}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-amber-400 font-bold block">
                        {seat.chips.toLocaleString()} 🪙
                      </span>
                    </div>
                  </div>

                  {/* Host seat management / Remove bot */}
                  {isHost && (
                    <button
                      onClick={() => handleRemoveSeat(seatIndex)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      title={seat.isBot ? "Botu Masadan Çıkar" : "Oyuncuyu Masadan Kaldır"}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Bot Thinking indicator */}
                {isBotThinking && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 px-2 py-1 rounded-full bg-indigo-600/90 text-white font-black text-[10px] flex items-center gap-1 shadow-lg animate-pulse">
                    <Bot size={12} /> Düşünüyor...
                  </div>
                )}

                {/* Hand Cards */}
                <div className="flex items-center justify-center -space-x-4 sm:-space-x-5 my-1 min-h-[70px] sm:min-h-[95px]">
                  {hasHand ? (
                    hand.cards.map((c, idx) => (
                      <PlayingCard
                        key={c.id || idx}
                        card={c}
                        size="sm"
                        className="transform hover:-translate-y-2 transition-transform shadow-md"
                      />
                    ))
                  ) : (
                    <div className="w-9 h-13 sm:w-12 sm:h-18 rounded-lg border border-dashed border-emerald-500/30 flex items-center justify-center text-emerald-400/40 text-[10px] font-bold">
                      {seat.hands[0]?.bet ? `${seat.hands[0].bet} 🪙` : 'Bahis Yok'}
                    </div>
                  )}
                </div>

                {/* Seat Footer: Score & Bet & Status Badge */}
                <div className="flex flex-col items-center gap-0.5 sm:gap-1 w-full mt-1">
                  {hasHand && (
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.2 rounded-full bg-slate-900/90 text-amber-300 font-black text-[9px] sm:text-[10px] border border-amber-500/30 shadow">
                        {formatScoreDisplay(hand.cards)}
                      </span>
                      <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 font-bold text-[9px] sm:text-[10px] border border-emerald-600/30">
                        {hand.bet} 🪙
                      </span>
                    </div>
                  )}

                  {/* Round End Results Badge */}
                  {table.phase === 'ROUND_END' && hand && (
                    <div className="w-full text-center">
                      {hand.result === 'BLACKJACK' ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[9px] sm:text-[10px] animate-pulse">
                          BLACKJACK! (+{hand.payout} 🪙)
                        </span>
                      ) : hand.result === 'WIN' ? (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500 text-white font-black text-[9px] sm:text-[10px]">
                          KAZANDI (+{hand.payout} 🪙)
                        </span>
                      ) : hand.result === 'BUST' ? (
                        <span className="px-1.5 py-0.2 rounded bg-rose-600 text-white font-black text-[9px] sm:text-[10px]">
                          PATLADI (BUST)
                        </span>
                      ) : hand.result === 'PUSH' ? (
                        <span className="px-1.5 py-0.2 rounded bg-amber-600 text-white font-black text-[9px] sm:text-[10px]">
                          BERABERE (PUSH)
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded bg-slate-700 text-slate-300 font-bold text-[9px] sm:text-[10px]">
                          KAYBETTİ
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- Bottom Controls Action Bar --- */}
        <div className="mt-1 sm:mt-2 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/30 p-2.5 sm:p-4 relative z-20 shadow-2xl">
          {table.phase === 'BETTING' ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3">
              {/* Chip Selector */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto justify-center sm:justify-start">
                <span className="text-xs font-black text-slate-400 mr-1 hidden sm:inline">ÇİPLER:</span>
                {chipValues.map((val) => (
                  <button
                    key={val}
                    disabled={isDealing}
                    onClick={() => {
                      setSelectedBetChip(val);
                      handlePlaceBet(val);
                    }}
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full font-black text-[11px] sm:text-xs transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center shadow-lg cursor-pointer disabled:opacity-40 ${
                      selectedBetChip === val ? 'ring-2 ring-amber-300' : ''
                    } ${
                      val <= 25
                        ? 'bg-blue-600 text-white border-2 border-blue-300'
                        : val <= 100
                        ? 'bg-emerald-600 text-white border-2 border-emerald-300'
                        : val <= 500
                        ? 'bg-rose-600 text-white border-2 border-rose-300'
                        : val <= 1000
                        ? 'bg-slate-950 text-amber-400 border-2 border-amber-400'
                        : 'bg-purple-600 text-white border-2 border-purple-300'
                    }`}
                  >
                    {val >= 1000 ? `${val / 1000}k` : val}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <button
                  onClick={handleClearBet}
                  disabled={isDealing}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  Temizle
                </button>
                <button
                  onClick={handleAllIn}
                  disabled={isDealing}
                  className="px-3 py-2 rounded-xl bg-amber-600/30 hover:bg-amber-600/50 text-amber-400 border border-amber-500/40 font-black text-xs transition-colors cursor-pointer disabled:opacity-40"
                >
                  ALL-IN
                </button>
                {isHost && (
                  <button
                    onClick={handleStartDeal}
                    disabled={isDealing}
                    className="px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/40 flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <Play size={16} /> {isDealing ? 'DAĞITILIYOR...' : 'KARTLARI DAĞIT'}
                  </button>
                )}
              </div>
            </div>
          ) : table.phase === 'PLAYER_TURNS' ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs sm:text-sm font-black text-amber-300">
                  {table.activeSeatIndex === mySeatIndex ? 'SIRA SENDE!' : `Sıra: ${table.seats[table.activeSeatIndex]?.username || 'Oyuncu'}`}
                </span>
              </div>

              {/* In-turn Actions */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto justify-center sm:justify-end">
                <button
                  onClick={() => handleHit(mySeatIndex)}
                  disabled={!isMyTurn || isDealing || isDealerPlaying}
                  className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>🃏 HIT (KART)</span>
                </button>
                <button
                  onClick={() => handleStand(mySeatIndex)}
                  disabled={!isMyTurn || isDealing || isDealerPlaying}
                  className="px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>✋ STAND (KAL)</span>
                </button>
                <button
                  onClick={() => handleDouble(mySeatIndex)}
                  disabled={!isMyTurn || isDealing || isDealerPlaying || !myCurrentHand || myCurrentHand.cards.length !== 2 || (mySeat?.chips || 0) < (myCurrentHand?.bet || 0)}
                  className="px-3 py-2 sm:py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>⚡ DOUBLE</span>
                </button>
                <button
                  onClick={() => handleSplit(mySeatIndex)}
                  disabled={
                    !isMyTurn ||
                    isDealing ||
                    isDealerPlaying ||
                    !myCurrentHand ||
                    myCurrentHand.cards.length !== 2 ||
                    myCurrentHand.cards[0].rank !== myCurrentHand.cards[1].rank ||
                    (mySeat?.chips || 0) < (myCurrentHand?.bet || 0)
                  }
                  className="px-3 py-2 sm:py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>✂️ SPLIT</span>
                </button>
              </div>
            </div>
          ) : table.phase === 'ROUND_END' ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-amber-400">
                  Tur Tamamlandı!
                </h3>
                <p className="text-[11px] text-slate-400">
                  Kazançlar ve bakiyeler güncellendi.
                </p>
              </div>

              {countdownSeconds !== null && (
                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800 text-xs font-bold text-amber-300 border border-amber-500/20">
                  <Clock size={13} className="animate-spin" />
                  <span>Sonraki Tur: {countdownSeconds}s</span>
                </div>
              )}

              {isHost && (
                <button
                  onClick={handleNextRound}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm shadow-xl flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105"
                >
                  <RefreshCw size={15} /> YENİ EL BAŞLAT
                </button>
              )}
            </div>
          ) : (
            <div className="text-center py-1 text-xs text-slate-400 font-bold flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Krupiye (Kasa) kart çekiyor, lütfen bekleyin...</span>
            </div>
          )}
        </div>

        {/* --- Footer Legal Disclaimer (Eğlence & Simülasyon) --- */}
        <div className="text-[10px] text-slate-400/80 flex items-center justify-center gap-1.5 py-0.5 text-center">
          <span>ℹ️ Bu oyunlar ve liderlik tablosu yalnızca sosyal eğlence ve simülasyon amaçlıdır. Gösterilen sanal çiplerin hiçbir maddi karşılığı yoktur.</span>
        </div>
      </div>

      {/* --- Rules Modal --- */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-amber-400 flex items-center gap-2">
                <span>🃏</span> Blackjack 21 Kuralları
              </h3>
              <button
                onClick={() => setShowRulesModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="text-xs text-slate-300 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p><strong>Amaç:</strong> 21 sayısını aşmadan krupiyeden (Kasa) daha yüksek bir el skoruna ulaşmaktır.</p>
              <p><strong>Kart Değerleri:</strong> As (A) duruma göre 1 veya 11 sayılır. Papaz (K), Kız (Q), Vale (J) ve 10 kartları 10 puan, diğer kartlar kendi sayısal değerindedir.</p>
              <p><strong>Blackjack:</strong> İlk 2 kartta As + 10/J/Q/K gelmesi durumunda doğrudan Blackjack olunur ve 3:2 (1.5 katı) ödeme yapılır.</p>
              <p><strong>Kasa Kuralı:</strong> Krupiye el toplamı 16 ve altında olduğunda kart çekmek (Hit), 17 ve üzerine ulaştığında durmak (Stand) zorundadır.</p>
              <p><strong>Double Down (İkiye Katla):</strong> İlk iki kartınız varken bahsinizi iki katına çıkarıp sadece 1 kart çekerek kalırsınız.</p>
              <p><strong>Split (Bölme):</strong> İlk iki kartınız aynı değerdeyse elinizi iki ayrı ele bölebilirsiniz.</p>
            </div>
            <button
              onClick={() => setShowRulesModal(false)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors cursor-pointer"
            >
              Anladım
            </button>
          </div>
        </div>
      )}

      {/* --- Emirgan Virtual Chip Manager Modal --- */}
      {showAdminModal && isEmirgan && (
        <AdminChipManagerModal
          socket={socket}
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          currentUsername={username}
          preselectedUser={mySeat ? { id: mySeat.userId || currentUserId, username: mySeat.username, avatar: mySeat.avatar, chips: mySeat.chips } : null}
          onSuccess={(userId, newChips) => {
            setTable((prev) => {
              const nextSeats = prev.seats.map((s) => (s && s.userId === userId ? { ...s, chips: newChips } : s));
              return { ...prev, seats: nextSeats };
            });
            if (userId === currentUserId) {
              setCurrentUserChips(newChips);
            }
          }}
        />
      )}

    </div>
  );
}

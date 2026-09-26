import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { 
  ArrowLeft, Users, Bot, Plus, RefreshCw, Shield, Sparkles, Trophy, 
  HelpCircle, Settings, Play, Flame, DollarSign, X, Check, Volume2, VolumeX,
  Coins, Clock, Zap
} from 'lucide-react';
import PlayingCard, { Card } from './PlayingCard';
import Avatar from './Avatar';
import AdminChipManagerModal from './AdminChipManagerModal';
import { 
  BlackjackState, BlackjackSeat, BlackjackHand, HandResult,
  calculateHandScore, formatScoreDisplay, decideBotAction, 
  drawCard, initializeBlackjackTable 
} from '../utils/blackjackEngine';

interface BlackjackGameProps {
  socket: Socket | null;
  currentUserId: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  tableId?: string | null;
  onBackToHub: () => void;
}

const CHIP_VALUES = [10, 25, 50, 100, 250, 500];
const BOT_NAMES = ['Bot Mert', 'Bot Zeynep', 'Bot Kaan', 'Bot Selin', 'Bot Emre'];

// Promise-based precision pacing delay
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function BlackjackGame({
  socket,
  currentUserId,
  username,
  avatar,
  color,
  tableId,
  onBackToHub
}: BlackjackGameProps) {
  // Local state holding the full table state
  const [table, setTable] = useState<BlackjackState>(() => 
    initializeBlackjackTable(tableId || 'bj_local', 'Blackjack 21 VIP', currentUserId, username, avatar, color)
  );

  const [selectedBetChip, setSelectedBetChip] = useState<number>(50);
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
  const mySeat = table.seats.find(s => s && s.userId === currentUserId) || null;
  const mySeatIndex = mySeat ? mySeat.seatIndex : -1;

  // Banner message helper
  const showBanner = (text: string, type: 'win' | 'lose' | 'bj' | 'push' | 'info' = 'info', duration = 3000) => {
    setBannerMessage({ text, type });
    setTimeout(() => setBannerMessage(null), duration);
  };

  // --- Socket.io Multiplayer Sync & Balance Tracking ---
  useEffect(() => {
    if (!socket) return;

    const onTableState = (syncedTable: BlackjackState) => {
      if (syncedTable && syncedTable.id === table.id) {
        setTable(syncedTable);
      }
    };

    const onChipsUpdated = (data: { userId: number; chips: number; message?: string }) => {
      if (data && data.userId === currentUserId) {
        setTable(prev => {
          const nextSeats = prev.seats.map(s => s && s.userId === currentUserId ? { ...s, chips: data.chips } : s);
          return { ...prev, seats: nextSeats };
        });
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

  // --- Bot / Turn Runner Engine with Realistic Pacing ---
  useEffect(() => {
    if (!isHost || isDealing || isDealerPlaying) return;

    let timer: NodeJS.Timeout | null = null;

    // Phase 1: If in BETTING and bots need to bet
    if (table.phase === 'BETTING') {
      const botsWithoutBets = table.seats.filter(s => s && s.isBot && (!s.hands[0] || s.hands[0].bet === 0));
      if (botsWithoutBets.length > 0) {
        timer = setTimeout(() => {
          setTable(prev => {
            const nextSeats = prev.seats.map(s => {
              if (!s || !s.isBot) return s;
              const bet = Math.min(s.chips, Math.max(prev.minBet, [25, 50, 100, 150][Math.floor(Math.random() * 4)]));
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
        }, 700);
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
          }, 1100);
        }
      }
    }

    // Phase 3: DEALER_TURN
    if (table.phase === 'DEALER_TURN' && !isDealerPlaying) {
      playDealerTurn();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [table.phase, table.activeSeatIndex, table.seats, isHost, isDealing, isDealerPlaying]);

  // --- Betting Handlers ---
  const handlePlaceBet = (amount: number) => {
    if (table.phase !== 'BETTING' || mySeatIndex === -1 || !mySeat || isDealing) return;
    if (mySeat.chips < amount) {
      showBanner('Yetersiz bakiye! Ücretsiz sanal çip doldurabilirsiniz.', 'lose');
      return;
    }

    setTable(prev => {
      const nextSeats = [...prev.seats];
      const s = nextSeats[mySeatIndex];
      if (!s) return prev;

      const currentBet = s.hands[0]?.bet || 0;
      const newBet = Math.min(s.chips, Math.min(prev.maxBet, currentBet + amount));
      
      nextSeats[mySeatIndex] = {
        ...s,
        hands: [{
          cards: [],
          bet: newBet,
          result: 'PLAYING' as HandResult,
          isDouble: false,
          isSplit: false,
          score: 0,
          isSoft: false,
          payout: 0
        }],
        isReady: newBet >= prev.minBet
      };

      return { ...prev, seats: nextSeats };
    });
  };

  const handleClearBet = () => {
    if (table.phase !== 'BETTING' || mySeatIndex === -1 || isDealing) return;
    setTable(prev => {
      const nextSeats = [...prev.seats];
      const s = nextSeats[mySeatIndex];
      if (s) {
        nextSeats[mySeatIndex] = {
          ...s,
          hands: [],
          isReady: false
        };
      }
      return { ...prev, seats: nextSeats };
    });
  };

  const handleAllIn = () => {
    if (table.phase !== 'BETTING' || mySeatIndex === -1 || !mySeat || isDealing) return;
    handlePlaceBet(mySeat.chips);
  };

  // Free Chip Refill Handler
  const handleRefillChips = async () => {
    if (socket && socket.connected) {
      socket.emit('refill_chips', (res: any) => {
        if (res?.success) {
          showBanner('500 Sanal Çip Hesabınıza Eklendi! 🪙', 'win');
        } else {
          showBanner(res?.error || 'Çip doldurulamadı.', 'info');
        }
      });
    } else {
      setTable(prev => {
        const nextSeats = [...prev.seats];
        if (mySeatIndex !== -1 && nextSeats[mySeatIndex]) {
          nextSeats[mySeatIndex] = { ...nextSeats[mySeatIndex]!, chips: 500 };
        }
        return { ...prev, seats: nextSeats };
      });
      showBanner('500 Sanal Çip Hesabınıza Eklendi! 🪙', 'win');
    }
  };

  // --- Sequential Initial Dealing (Real-world Casino Pacing) ---
  const handleStartDeal = async () => {
    if (table.phase !== 'BETTING' || isDealing) return;

    // Check if at least 1 player bet
    const bettingSeats = table.seats.filter(s => s && (s.hands[0]?.bet || 0) >= table.minBet);
    if (bettingSeats.length === 0) {
      showBanner('En az bir oyuncu minimum bahis koymalıdır!', 'info');
      return;
    }

    setIsDealing(true);
    let currentShoe = [...table.shoe];
    const workingSeats: (BlackjackSeat | null)[] = table.seats.map(s => {
      if (s && (s.hands[0]?.bet || 0) >= table.minBet) {
        return {
          ...s,
          chips: s.chips - s.hands[0].bet,
          hands: [{
            cards: [],
            bet: s.hands[0].bet,
            result: 'PLAYING' as HandResult,
            isDouble: false,
            isSplit: false,
            score: 0,
            isSoft: false,
            payout: 0
          }],
          activeHandIndex: 0
        };
      }
      return s ? { ...s, hands: [] } : null;
    });

    // 1. Pass 1: Give 1st card to each active player with 400ms delay
    for (let i = 0; i < workingSeats.length; i++) {
      if (workingSeats[i] && workingSeats[i]!.hands.length > 0) {
        const d = drawCard(currentShoe);
        currentShoe = d.remainingShoe;
        workingSeats[i]!.hands[0].cards.push(d.card);
        const { score, isSoft } = calculateHandScore(workingSeats[i]!.hands[0].cards);
        workingSeats[i]!.hands[0].score = score;
        workingSeats[i]!.hands[0].isSoft = isSoft;
        
        setTable(prev => ({ ...prev, phase: 'DEALING', shoe: currentShoe, seats: [...workingSeats] }));
        await wait(400);
      }
    }

    // 2. Pass 1: Give 1st face-up card to dealer with 600ms delay
    const dealerCard1 = drawCard(currentShoe);
    currentShoe = dealerCard1.remainingShoe;
    const dealerCards = [dealerCard1.card];
    const dScore1 = calculateHandScore(dealerCards);

    setTable(prev => ({
      ...prev,
      shoe: currentShoe,
      dealer: { ...prev.dealer, cards: dealerCards, score: dScore1.score, isSoft: dScore1.isSoft }
    }));
    await wait(600);

    // 3. Pass 2: Give 2nd card to each active player with 400ms delay
    for (let i = 0; i < workingSeats.length; i++) {
      if (workingSeats[i] && workingSeats[i]!.hands.length > 0) {
        const d = drawCard(currentShoe);
        currentShoe = d.remainingShoe;
        workingSeats[i]!.hands[0].cards.push(d.card);
        const { score, isSoft, isBlackjack } = calculateHandScore(workingSeats[i]!.hands[0].cards);
        workingSeats[i]!.hands[0].score = score;
        workingSeats[i]!.hands[0].isSoft = isSoft;
        if (isBlackjack) {
          workingSeats[i]!.hands[0].result = 'BLACKJACK';
        }
        
        setTable(prev => ({ ...prev, shoe: currentShoe, seats: [...workingSeats] }));
        await wait(400);
      }
    }

    // 4. Pass 2: Give 2nd face-down hole card to dealer with 600ms delay
    const dealerCard2 = drawCard(currentShoe);
    currentShoe = dealerCard2.remainingShoe;
    dealerCards.push(dealerCard2.card);
    const dScore2 = calculateHandScore(dealerCards);

    setTable(prev => ({
      ...prev,
      shoe: currentShoe,
      dealer: { ...prev.dealer, cards: dealerCards, score: dScore2.score, isSoft: dScore2.isSoft, hasBlackjack: dScore2.isBlackjack }
    }));
    await wait(600);

    // Find first active player
    let firstActiveIndex = workingSeats.findIndex(s => s && s.hands[0] && s.hands[0].result === 'PLAYING');
    const nextPhase = firstActiveIndex !== -1 ? 'PLAYER_TURNS' : 'DEALER_TURN';

    const finalizedTable: BlackjackState = {
      ...table,
      phase: nextPhase,
      shoe: currentShoe,
      seats: workingSeats,
      activeSeatIndex: firstActiveIndex,
      dealer: {
        cards: dealerCards,
        score: dScore2.score,
        isSoft: dScore2.isSoft,
        isBust: false,
        hasBlackjack: dScore2.isBlackjack
      },
      turnExpiresAt: Date.now() + 20000
    };

    setIsDealing(false);
    broadcastTable(finalizedTable);
  };

  // --- Player Actions Advance Helper ---
  const advanceToNextPlayer = (state: BlackjackState, currentSeatIndex: number): BlackjackState => {
    let nextIndex = -1;
    for (let i = currentSeatIndex + 1; i < state.seats.length; i++) {
      const seat = state.seats[i];
      if (seat && seat.hands.some(h => h.result === 'PLAYING')) {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex !== -1) {
      return {
        ...state,
        activeSeatIndex: nextIndex,
        turnExpiresAt: Date.now() + 20000
      };
    } else {
      return {
        ...state,
        phase: 'DEALER_TURN',
        activeSeatIndex: -1
      };
    }
  };

  // --- Hit ---
  const handleHit = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;

    let shoe = [...table.shoe];
    const draw = drawCard(shoe);
    shoe = draw.remainingShoe;

    const nextSeats = [...table.seats];
    const seat = nextSeats[seatIndex];
    if (!seat) return;

    const hand = seat.hands[seat.activeHandIndex];
    if (!hand || hand.result !== 'PLAYING') return;

    const newCards = [...hand.cards, draw.card];
    const { score, isSoft } = calculateHandScore(newCards);

    let nextResult: HandResult = hand.result;
    let shouldAdvance = false;

    if (score > 21) {
      nextResult = 'BUST';
      shouldAdvance = true;
      if (seat.userId === currentUserId) {
        showBanner('Patladınız! (BUST - 21 aşıldı)', 'lose');
      }
    } else if (score === 21) {
      nextResult = 'STAND';
      shouldAdvance = true;
    }

    const updatedHand: BlackjackHand = {
      ...hand,
      cards: newCards,
      score,
      isSoft,
      result: nextResult
    };

    const nextHands = [...seat.hands];
    nextHands[seat.activeHandIndex] = updatedHand;
    nextSeats[seatIndex] = { ...seat, hands: nextHands };

    let nextTable: BlackjackState = { ...table, shoe, seats: nextSeats };

    if (shouldAdvance) {
      if (seat.activeHandIndex + 1 < seat.hands.length && seat.hands[seat.activeHandIndex + 1].result === 'PLAYING') {
        nextSeats[seatIndex] = { ...seat, activeHandIndex: seat.activeHandIndex + 1 };
        nextTable = { ...nextTable, seats: nextSeats };
      } else {
        nextTable = advanceToNextPlayer(nextTable, seatIndex);
      }
    }

    broadcastTable(nextTable);
  };

  // --- Stand ---
  const handleStand = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;

    const nextSeats = [...table.seats];
    const seat = nextSeats[seatIndex];
    if (!seat) return;

    const hand = seat.hands[seat.activeHandIndex];
    if (!hand) return;

    const nextHands = [...seat.hands];
    nextHands[seat.activeHandIndex] = { ...hand, result: 'STAND' as HandResult };
    nextSeats[seatIndex] = { ...seat, hands: nextHands };

    let nextTable: BlackjackState = { ...table, seats: nextSeats };

    if (seat.activeHandIndex + 1 < seat.hands.length && seat.hands[seat.activeHandIndex + 1].result === 'PLAYING') {
      nextSeats[seatIndex] = { ...seat, activeHandIndex: seat.activeHandIndex + 1 };
      nextTable = { ...nextTable, seats: nextSeats };
    } else {
      nextTable = advanceToNextPlayer(nextTable, seatIndex);
    }

    broadcastTable(nextTable);
  };

  // --- Double Down ---
  const handleDouble = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;

    const nextSeats = [...table.seats];
    const seat = nextSeats[seatIndex];
    if (!seat) return;

    const hand = seat.hands[seat.activeHandIndex];
    if (!hand || hand.cards.length !== 2 || seat.chips < hand.bet) return;

    const remainingChips = seat.chips - hand.bet;
    const newBet = hand.bet * 2;

    let shoe = [...table.shoe];
    const draw = drawCard(shoe);
    shoe = draw.remainingShoe;

    const newCards = [...hand.cards, draw.card];
    const { score, isSoft } = calculateHandScore(newCards);
    const nextResult: HandResult = score > 21 ? 'BUST' : 'STAND';

    const nextHands = [...seat.hands];
    nextHands[seat.activeHandIndex] = {
      ...hand,
      cards: newCards,
      bet: newBet,
      score,
      isSoft,
      isDouble: true,
      result: nextResult
    };

    nextSeats[seatIndex] = {
      ...seat,
      chips: remainingChips,
      hands: nextHands
    };

    let nextTable: BlackjackState = { ...table, shoe, seats: nextSeats };
    nextTable = advanceToNextPlayer(nextTable, seatIndex);
    broadcastTable(nextTable);
  };

  // --- Split ---
  const handleSplit = (seatIndex: number) => {
    if (table.phase !== 'PLAYER_TURNS' || table.activeSeatIndex !== seatIndex || isDealing || isDealerPlaying) return;

    const nextSeats = [...table.seats];
    const seat = nextSeats[seatIndex];
    if (!seat) return;

    const hand = seat.hands[seat.activeHandIndex];
    if (!hand || hand.cards.length !== 2 || seat.chips < hand.bet) return;

    let shoe = [...table.shoe];
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

  // --- Paced Dealer Turn (1000ms pause -> Flip hole card -> 1400ms pause -> Hit loop with 1400ms interval -> Persist) ---
  const playDealerTurn = async () => {
    setIsDealerPlaying(true);

    // Step 1: 1000ms tension pause
    await wait(1000);

    // Step 2: Reveal dealer hole card (flip)
    let shoe = [...table.shoe];
    const dealerCards = [...table.dealer.cards];
    let { score, isSoft, isBlackjack } = calculateHandScore(dealerCards);

    setTable(prev => ({
      ...prev,
      dealer: {
        ...prev.dealer,
        score,
        isSoft,
        hasBlackjack: isBlackjack
      }
    }));

    // Step 3: 1400ms pause to let players absorb dealer initial score
    await wait(1400);

    // Step 4: Dealer Hit Loop (Draw 1 card -> calculate score -> wait 1400ms -> repeat)
    while (score < 17) {
      const draw = drawCard(shoe);
      shoe = draw.remainingShoe;
      dealerCards.push(draw.card);
      const res = calculateHandScore(dealerCards);
      score = res.score;
      isSoft = res.isSoft;

      setTable(prev => ({
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

    // Step 5: 1200ms pause before calculating payouts
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
      setCountdownSeconds(prev => {
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

    const nextSeats = table.seats.map(s => {
      if (!s) return null;
      return {
        ...s,
        hands: [],
        activeHandIndex: 0,
        insuranceBet: 0,
        hasInsurance: false,
        isReady: false
      };
    });

    const newTable: BlackjackState = {
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

    broadcastTable(newTable);
  };

  // --- Seat Management ---
  const handleAddBot = (seatIndex: number) => {
    if (table.seats[seatIndex]) return;
    const availableName = BOT_NAMES[seatIndex % BOT_NAMES.length];
    
    setTable(prev => {
      const nextSeats = [...prev.seats];
      nextSeats[seatIndex] = {
        seatIndex,
        username: availableName,
        isBot: true,
        chips: 2500,
        hands: [],
        activeHandIndex: 0,
        insuranceBet: 0,
        hasInsurance: false,
        isReady: false
      };
      return { ...prev, seats: nextSeats };
    });
  };

  const handleRemoveSeat = (seatIndex: number) => {
    setTable(prev => {
      const nextSeats = [...prev.seats];
      nextSeats[seatIndex] = null;
      return { ...prev, seats: nextSeats };
    });
  };

  const handleSitDown = (seatIndex: number) => {
    if (table.seats[seatIndex]) return;
    setTable(prev => {
      const nextSeats = prev.seats.map(s => (s && s.userId === currentUserId ? null : s));
      nextSeats[seatIndex] = {
        seatIndex,
        userId: currentUserId,
        username,
        avatar,
        color,
        isBot: false,
        chips: 1000,
        hands: [],
        activeHandIndex: 0,
        insuranceBet: 0,
        hasInsurance: false,
        isReady: false
      };
      return { ...prev, seats: nextSeats };
    });
  };

  // Determine current active hand for player
  const myCurrentHand = mySeat && mySeat.hands[mySeat.activeHandIndex];
  const isMyTurn = table.phase === 'PLAYER_TURNS' && table.activeSeatIndex === mySeatIndex && myCurrentHand?.result === 'PLAYING' && !isDealing && !isDealerPlaying;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-slate-950 text-slate-100 select-none overflow-hidden relative">
      
      {/* --- Top Navigation & HUD --- */}
      <div className="px-4 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-amber-500/20 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-3">
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
              <h1 className="text-sm sm:text-base font-black text-amber-400 tracking-tight flex items-center gap-1.5">
                Blackjack 21 VIP
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {isDealing ? 'KARTLAR DAĞITILIYOR' : isDealerPlaying ? 'KASA SIRASI' : table.phase === 'BETTING' ? 'BAHİS' : table.phase === 'PLAYER_TURNS' ? 'OYUNDA' : 'TUR SONU'}
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">
                Min: {table.minBet}$ • Max: {table.maxBet}$ • 6 Deste (Shoe)
              </p>
            </div>
          </div>
        </div>

        {/* Right HUD Controls */}
        <div className="flex items-center gap-2">
          {/* User Chips */}
          {mySeat && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 font-extrabold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm">
              <Coins size={15} className="text-amber-400" />
              <span>{mySeat.chips.toLocaleString()} 🪙</span>
            </div>
          )}

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
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Ses Aç/Kapat"
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Blackjack Kuralları"
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {/* --- Banner Notification --- */}
      {bannerMessage && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 animate-bounce">
          <div className={`px-5 py-2.5 rounded-2xl font-black text-sm shadow-2xl border flex items-center gap-2 ${
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
        className="flex-1 flex flex-col justify-between p-3 sm:p-5 overflow-hidden relative"
        style={{
          background: 'radial-gradient(ellipse at center, #065f46 0%, #064e3b 40%, #022c22 75%, #021a14 100%)'
        }}
      >
        {/* Table Felt Arch Lines */}
        <div className="absolute inset-4 sm:inset-8 border-2 border-dashed border-emerald-400/20 rounded-[80px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none opacity-20">
          <h2 className="text-3xl sm:text-5xl font-black tracking-widest uppercase text-emerald-300">
            BLACKJACK PAYS 3 TO 2
          </h2>
          <p className="text-xs sm:text-sm font-bold tracking-widest text-emerald-200 mt-1">
            DEALER MUST STAND ON 17 AND MUST DRAW TO 16
          </p>
        </div>

        {/* --- Top Dealer Area --- */}
        <div className="flex flex-col items-center justify-center pt-2 relative z-10">
          <div className="flex items-center gap-2 mb-2">
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
          <div className="flex items-center justify-center gap-2 min-h-[90px] sm:min-h-[110px]">
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
        <div className="grid grid-cols-5 gap-2 sm:gap-4 my-auto relative z-10">
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
                  <span className="text-xs text-emerald-400/60 font-bold mb-2">Koltuk {seatIndex + 1}</span>
                  {isHost ? (
                    <div className="flex flex-col gap-1.5 w-full max-w-[90px]">
                      <button
                        onClick={() => handleAddBot(seatIndex)}
                        disabled={isDealing || isDealerPlaying}
                        className="px-2 py-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 shadow cursor-pointer transition-colors disabled:opacity-40"
                      >
                        <Bot size={13} /> +Bot
                      </button>
                      <button
                        onClick={() => handleSitDown(seatIndex)}
                        disabled={isDealing || isDealerPlaying}
                        className="px-2 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 shadow cursor-pointer transition-colors disabled:opacity-40"
                      >
                        <Plus size={13} /> Otur
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSitDown(seatIndex)}
                      disabled={isDealing || isDealerPlaying}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all disabled:opacity-40"
                    >
                      <Plus size={14} /> Otur
                    </button>
                  )}
                </div>
              );
            }

            const hand = seat.hands[0];
            const hasHand = Boolean(hand && hand.cards.length > 0);

            return (
              <div
                key={seatIndex}
                className={`relative flex flex-col items-center justify-between p-2 sm:p-3 rounded-2xl transition-all duration-300 min-h-[150px] sm:min-h-[190px] ${
                  isCurrentTurn
                    ? 'bg-amber-950/80 border-2 border-amber-400 ring-4 ring-amber-400/30 shadow-2xl scale-105'
                    : isMe
                    ? 'bg-slate-900/90 border-2 border-emerald-400/60 shadow-lg'
                    : 'bg-black/50 border border-emerald-500/30 shadow'
                }`}
              >
                {/* Seat Header (Avatar & Username & Controls) */}
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar
                      url={seat.avatar}
                      name={seat.username}
                      color={seat.color || undefined}
                      size={6}
                    />
                    <div className="min-w-0 truncate">
                      <span className={`text-[11px] font-black truncate block ${isMe ? 'text-emerald-400' : 'text-slate-200'}`}>
                        {seat.username}
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold block">
                        {seat.chips.toLocaleString()} 🪙
                      </span>
                    </div>
                  </div>

                  {/* Host seat management */}
                  {isHost && (
                    <button
                      onClick={() => handleRemoveSeat(seatIndex)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 transition-colors"
                      title="Koltuktan Kaldır"
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
                <div className="flex items-center justify-center -space-x-4 sm:-space-x-5 my-1 min-h-[75px] sm:min-h-[95px]">
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
                    <div className="w-10 h-14 sm:w-12 sm:h-18 rounded-lg border border-dashed border-emerald-500/30 flex items-center justify-center text-emerald-400/40 text-[10px] font-bold">
                      {seat.hands[0]?.bet ? `${seat.hands[0].bet} 🪙` : 'Bahis Yok'}
                    </div>
                  )}
                </div>

                {/* Seat Footer: Score & Bet & Status Badge */}
                <div className="flex flex-col items-center gap-1 w-full mt-1">
                  {hasHand && (
                    <div className="flex items-center gap-1">
                      <span className="px-2 py-0.5 rounded-full bg-slate-900/90 text-amber-300 font-black text-[10px] border border-amber-500/30 shadow">
                        {formatScoreDisplay(hand.cards)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold text-[10px] border border-emerald-600/30">
                        {hand.bet} 🪙
                      </span>
                    </div>
                  )}

                  {/* Round End Results Badge */}
                  {table.phase === 'ROUND_END' && hand && (
                    <div className="w-full text-center">
                      {hand.result === 'BLACKJACK' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black text-[10px] animate-pulse">
                          BLACKJACK! (+{hand.payout} 🪙)
                        </span>
                      ) : hand.result === 'WIN' ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500 text-white font-black text-[10px]">
                          KAZANDI (+{hand.payout} 🪙)
                        </span>
                      ) : hand.result === 'BUST' ? (
                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[10px]">
                          PATLADI (BUST)
                        </span>
                      ) : hand.result === 'PUSH' ? (
                        <span className="px-2 py-0.5 rounded bg-amber-600 text-white font-black text-[10px]">
                          BERABERE (PUSH)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300 font-bold text-[10px]">
                          KAYBETTİ
                        </span>
                      )}
                    </div>
                  )}

                  {/* Free Refill Chips Button if Broke */}
                  {seat.chips <= 0 && isMe && (
                    <button
                      onClick={handleRefillChips}
                      className="w-full mt-1 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] flex items-center justify-center gap-1 animate-bounce cursor-pointer shadow"
                    >
                      <Sparkles size={12} /> +500 Çip Doldur
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* --- Bottom Controls Action Bar --- */}
        <div className="mt-2 bg-slate-900/95 backdrop-blur-md rounded-2xl border border-amber-500/30 p-3 sm:p-4 relative z-20 shadow-2xl">
          {table.phase === 'BETTING' ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Chip Selector */}
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto justify-center sm:justify-start">
                <span className="text-xs font-black text-slate-400 mr-1 hidden sm:inline">ÇİPLER:</span>
                {CHIP_VALUES.map((val) => (
                  <button
                    key={val}
                    disabled={isDealing}
                    onClick={() => {
                      setSelectedBetChip(val);
                      handlePlaceBet(val);
                    }}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full font-black text-xs transition-all transform hover:scale-110 active:scale-95 flex items-center justify-center shadow-lg cursor-pointer disabled:opacity-40 ${
                      val === 10
                        ? 'bg-blue-600 text-white border-2 border-blue-300'
                        : val === 25
                        ? 'bg-emerald-600 text-white border-2 border-emerald-300'
                        : val === 50
                        ? 'bg-rose-600 text-white border-2 border-rose-300'
                        : val === 100
                        ? 'bg-slate-950 text-amber-400 border-2 border-amber-400'
                        : val === 250
                        ? 'bg-purple-600 text-white border-2 border-purple-300'
                        : 'bg-amber-500 text-slate-950 border-2 border-white'
                    }`}
                  >
                    {val}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-900/40 flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50"
                  >
                    <Play size={16} /> {isDealing ? 'DAĞITILIYOR...' : 'KARTLARI DAĞIT'}
                  </button>
                )}
              </div>
            </div>
          ) : table.phase === 'PLAYER_TURNS' ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="text-xs sm:text-sm font-black text-amber-300">
                  {table.activeSeatIndex === mySeatIndex ? 'SIRA SENDE!' : `Sıra: ${table.seats[table.activeSeatIndex]?.username || 'Oyuncu'}`}
                </span>
              </div>

              {/* In-turn Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleHit(mySeatIndex)}
                  disabled={!isMyTurn || isDealing || isDealerPlaying}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>🃏 KART ÇEK (HIT)</span>
                </button>
                <button
                  onClick={() => handleStand(mySeatIndex)}
                  disabled={!isMyTurn || isDealing || isDealerPlaying}
                  className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>✋ KAL (STAND)</span>
                </button>
                <button
                  onClick={() => handleDouble(mySeatIndex)}
                  disabled={!isMyTurn || isDealing || isDealerPlaying || !myCurrentHand || myCurrentHand.cards.length !== 2 || (mySeat?.chips || 0) < (myCurrentHand?.bet || 0)}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>⚡ 2X DOUBLE</span>
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
                  className="px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:pointer-events-none text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>✂️ BÖL (SPLIT)</span>
                </button>
              </div>
            </div>
          ) : table.phase === 'ROUND_END' ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h3 className="text-sm sm:text-base font-black text-amber-400">
                  Tur Tamamlandı!
                </h3>
                <p className="text-xs text-slate-400">
                  Kazançlar ve bakiyeler güncellendi.
                </p>
              </div>

              {countdownSeconds !== null && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-amber-300 border border-amber-500/20">
                  <Clock size={14} className="animate-spin" />
                  <span>Sonraki Tur: {countdownSeconds}s</span>
                </div>
              )}

              {isHost && (
                <button
                  onClick={handleNextRound}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs sm:text-sm shadow-xl flex items-center gap-2 cursor-pointer transition-all transform hover:scale-105"
                >
                  <RefreshCw size={16} /> YENİ EL BAŞLAT
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
        <div className="text-[11px] text-slate-400/80 flex items-center justify-center gap-1.5 py-1 text-center">
          <span>ℹ️ Bu oyunlar ve liderlik tablosu yalnızca sosyal eğlence ve simülasyon amaçlıdır. Gösterilen sanal çiplerin/puanların hiçbir maddi veya parasal karşılığı yoktur, gerçek paraya dönüştürülemez.</span>
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
                className="p-1 rounded-lg text-slate-400 hover:text-white"
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
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors"
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
            setTable(prev => {
              const nextSeats = prev.seats.map(s => s && s.userId === userId ? { ...s, chips: newChips } : s);
              return { ...prev, seats: nextSeats };
            });
          }}
        />
      )}

    </div>
  );
}

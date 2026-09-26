import { Card, Rank } from '../components/PlayingCard';
import { createStandardDeck, shuffleDeck } from './cardDeck';

export type BlackjackPhase = 'BETTING' | 'DEALING' | 'PLAYER_TURNS' | 'DEALER_TURN' | 'ROUND_END';

export type HandResult = 
  | 'PLAYING'
  | 'STAND'
  | 'BUST'
  | 'BLACKJACK'
  | 'WIN'
  | 'LOSE'
  | 'PUSH';

export interface BlackjackHand {
  cards: Card[];
  bet: number;
  result: HandResult;
  isDouble: boolean;
  isSplit: boolean;
  score: number;
  isSoft: boolean;
  payout: number;
}

export interface BlackjackSeat {
  seatIndex: number;
  userId?: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  isBot: boolean;
  chips: number;
  hands: BlackjackHand[];
  activeHandIndex: number;
  insuranceBet: number;
  hasInsurance: boolean;
  isReady: boolean;
}

export interface DealerState {
  cards: Card[];
  score: number;
  isSoft: boolean;
  isBust: boolean;
  hasBlackjack: boolean;
}

export interface BlackjackState {
  id: string;
  title: string;
  hostId: number;
  phase: BlackjackPhase;
  shoe: Card[];
  seats: (BlackjackSeat | null)[]; // Max 5 seats
  activeSeatIndex: number;
  dealer: DealerState;
  minBet: number;
  maxBet: number;
  deckCount: number;
  turnTimeLimit: number;
  turnExpiresAt: number;
  history: string[];
}

// Card numeric value in Blackjack
export function getCardValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
  return parseInt(rank, 10);
}

// Calculate hand score with Ace handling (Soft vs Hard)
export function calculateHandScore(cards: Card[]): { score: number; isSoft: boolean; isBlackjack: boolean } {
  if (!cards || cards.length === 0) {
    return { score: 0, isSoft: false, isBlackjack: false };
  }

  let total = 0;
  let aces = 0;

  for (const card of cards) {
    if (card.rank === 'A') {
      aces++;
      total += 11;
    } else if (['K', 'Q', 'J', '10'].includes(card.rank)) {
      total += 10;
    } else {
      total += parseInt(card.rank, 10);
    }
  }

  // Adjust Aces from 11 down to 1 if over 21
  let isSoft = false;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  if (aces > 0 && total <= 21) {
    isSoft = true;
  }

  const isBlackjack = cards.length === 2 && total === 21;
  return { score: total, isSoft, isBlackjack };
}

// Formats score display (e.g., "7 / 17" for soft hands, or "21")
export function formatScoreDisplay(cards: Card[], isHiddenHoleCard = false): string {
  if (!cards || cards.length === 0) return '0';
  if (isHiddenHoleCard) {
    const visibleCards = cards.slice(0, 1);
    const { score } = calculateHandScore(visibleCards);
    return `${score}`;
  }

  const { score, isSoft } = calculateHandScore(cards);
  if (score > 21) return `${score} (BUST)`;
  if (isSoft && score < 21) {
    return `${score - 10} / ${score}`;
  }
  return `${score}`;
}

// Create a new Blackjack 6-deck Shoe
export function createShoe(deckCount = 6): Card[] {
  return shuffleDeck(createStandardDeck(deckCount));
}

// Draw card from shoe (reshuffle if low)
export function drawCard(shoe: Card[]): { card: Card; remainingShoe: Card[] } {
  let activeShoe = [...shoe];
  if (activeShoe.length < 30) {
    activeShoe = createShoe(6);
  }
  const card = activeShoe.pop()!;
  return { card, remainingShoe: activeShoe };
}

// Blackjack Basic Strategy Bot AI
export function decideBotAction(
  hand: BlackjackHand,
  dealerUpCard: Card | null,
  canDouble: boolean,
  canSplit: boolean,
  botChips: number
): 'hit' | 'stand' | 'double' | 'split' {
  const { score, isSoft } = calculateHandScore(hand.cards);
  const dealerValue = dealerUpCard ? getCardValue(dealerUpCard.rank) : 7;

  // Split logic
  if (canSplit && hand.cards.length === 2 && botChips >= hand.bet) {
    const rank1 = hand.cards[0].rank;
    const rank2 = hand.cards[1].rank;
    // Always split Aces and 8s
    if (rank1 === 'A' && rank2 === 'A') return 'split';
    if (rank1 === '8' && rank2 === '8') return 'split';
    // Split 9s against 2-6, 8-9 (not against 7, 10, A)
    if (rank1 === '9' && rank2 === '9' && [2, 3, 4, 5, 6, 8, 9].includes(dealerValue)) return 'split';
    // Split 7s, 6s, 3s, 2s against weak dealer (2-6)
    if (['7', '6', '3', '2'].includes(rank1) && rank1 === rank2 && dealerValue >= 2 && dealerValue <= 6) return 'split';
  }

  // Double Down logic (only 2 cards & enough chips)
  if (canDouble && hand.cards.length === 2 && botChips >= hand.bet) {
    if (score === 11) return 'double';
    if (score === 10 && dealerValue <= 9) return 'double';
    if (score === 9 && dealerValue >= 3 && dealerValue <= 6) return 'double';
    if (isSoft && (score === 17 || score === 18) && dealerValue >= 3 && dealerValue <= 6) return 'double';
  }

  // Soft Hand logic
  if (isSoft) {
    if (score <= 17) return 'hit';
    if (score === 18) {
      if (dealerValue >= 9 || dealerValue === 11) return 'hit';
      return 'stand';
    }
    return 'stand';
  }

  // Hard Hand logic
  if (score <= 11) return 'hit';
  if (score === 12) {
    if (dealerValue >= 4 && dealerValue <= 6) return 'stand';
    return 'hit';
  }
  if (score >= 13 && score <= 16) {
    if (dealerValue >= 2 && dealerValue <= 6) return 'stand';
    return 'hit';
  }
  return 'stand'; // 17 and above always stand
}

// Helper to initialize a pristine table
export function initializeBlackjackTable(
  id: string,
  title: string,
  hostId: number,
  hostUsername: string,
  hostAvatar?: string | null,
  hostColor?: string | null
): BlackjackState {
  const shoe = createShoe(6);
  const seats: (BlackjackSeat | null)[] = [
    {
      seatIndex: 0,
      userId: hostId,
      username: hostUsername,
      avatar: hostAvatar,
      color: hostColor,
      isBot: false,
      chips: 2500,
      hands: [],
      activeHandIndex: 0,
      insuranceBet: 0,
      hasInsurance: false,
      isReady: false
    },
    null,
    null,
    null,
    null
  ];

  return {
    id,
    title,
    hostId,
    phase: 'BETTING',
    shoe,
    seats,
    activeSeatIndex: -1,
    dealer: {
      cards: [],
      score: 0,
      isSoft: false,
      isBust: false,
      hasBlackjack: false
    },
    minBet: 25,
    maxBet: 1000,
    deckCount: 6,
    turnTimeLimit: 20,
    turnExpiresAt: Date.now() + 20000,
    history: ['Masa kuruldu. Bahislerinizi koyun ve dağıtımı başlatın.']
  };
}

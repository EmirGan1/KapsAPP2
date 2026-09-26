import { Card, Suit, Rank } from '../components/PlayingCard';
import { createStandardDeck, shuffleDeck, BATAK_RANK_VALUES } from './cardDeck';

export type BatakGameMode = 'ihale' | 'koz_maca';
export type BatakPhase = 'LOBBY' | 'BIDDING' | 'TRUMP_SELECTION' | 'PLAYING' | 'TRICK_END' | 'ROUND_SCORE' | 'GAME_OVER';

export interface BatakPlayer {
  seatIndex: number; // 0: South (Local/User), 1: West, 2: North, 3: East
  userId?: number;
  username: string;
  avatar?: string | null;
  color?: string | null;
  isBot: boolean;
  hand: Card[];
  bid: number; // 0: Pas, 1-13
  tricksWon: number;
  score: number;
  totalScore: number;
  isReady: boolean;
  isBiddingFinished: boolean;
}

export interface PlayedCard {
  seatIndex: number;
  card: Card;
  timestamp?: number;
}

export interface BatakState {
  id: string;
  title: string;
  hostId: number;
  gameMode: BatakGameMode;
  targetRounds: number; // e.g. 5, 9, 11
  currentRound: number;
  phase: BatakPhase;
  players: BatakPlayer[];
  dealerSeat: number;
  bidWinnerSeat: number | null;
  highestBid: number;
  trumpSuit: Suit | null;
  isTrumpBroken: boolean; // Has trump been ruffed / played before in the round?
  currentTrick: PlayedCard[];
  turnSeatIndex: number;
  trickWinnerSeat: number | null;
  leadSuit: Suit | null;
  tricksHistory: { winnerSeat: number; trick: PlayedCard[] }[];
  roundScores: { round: number; bids: number[]; tricks: number[]; scores: number[] }[];
  history: string[];
}

// Suit order for hand display: ♠ Spades, ♥ Hearts, ♦ Diamonds, ♣ Clubs
const SUIT_ORDER: Record<Suit, number> = {
  spades: 0,
  hearts: 1,
  diamonds: 2,
  clubs: 3
};

// Sort cards automatically by Suit then Rank ascending/descending
export function sortBatakHand(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    if (SUIT_ORDER[a.suit] !== SUIT_ORDER[b.suit]) {
      return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    }
    return BATAK_RANK_VALUES[a.rank] - BATAK_RANK_VALUES[b.rank];
  });
}

// Deal 52 cards evenly to 4 players (13 cards each)
export function dealBatakHands(): [Card[], Card[], Card[], Card[]] {
  const deck = shuffleDeck(createStandardDeck(1));
  const hand0 = sortBatakHand(deck.slice(0, 13));
  const hand1 = sortBatakHand(deck.slice(13, 26));
  const hand2 = sortBatakHand(deck.slice(26, 39));
  const hand3 = sortBatakHand(deck.slice(39, 52));
  return [hand0, hand1, hand2, hand3];
}

/**
 * 100% Strict Batak Legal Card Validator
 * Calculates exactly which cards in player's hand are playable according to official rules.
 */
export function getValidBatakCards(
  hand: Card[],
  currentTrick: PlayedCard[],
  trumpSuit: Suit | null,
  isTrumpBroken: boolean
): Card[] {
  if (!hand || hand.length === 0) return [];
  if (!trumpSuit) return hand; // fallback during uninitialized state

  // Case 1: Player leads the trick (First card)
  if (currentTrick.length === 0) {
    // If trump has NOT been broken yet, player cannot lead with trump unless they ONLY have trumps!
    if (!isTrumpBroken) {
      const nonTrumpCards = hand.filter(c => c.suit !== trumpSuit);
      if (nonTrumpCards.length > 0) {
        return nonTrumpCards;
      }
    }
    return hand;
  }

  // Case 2: Player responds to lead card in the current trick
  const leadCard = currentTrick[0].card;
  const leadSuit = leadCard.suit;
  const sameSuitCards = hand.filter(c => c.suit === leadSuit);

  // 2.A: Player HAS cards of the lead suit -> MUST follow suit!
  if (sameSuitCards.length > 0) {
    // Check if any trump has been played in this trick already
    const hasTrumpInTrick = currentTrick.some(p => p.card.suit === trumpSuit);

    // If no trump played yet in this trick, player MUST raise (üste çıkmak) if they can!
    if (!hasTrumpInTrick) {
      const highestLeadInTrick = Math.max(
        ...currentTrick.filter(p => p.card.suit === leadSuit).map(p => BATAK_RANK_VALUES[p.card.rank])
      );
      const higherCards = sameSuitCards.filter(c => BATAK_RANK_VALUES[c.rank] > highestLeadInTrick);
      
      // If player has higher card of lead suit, must play higher!
      if (higherCards.length > 0) {
        return higherCards;
      }
    }

    // Otherwise player can play any card of the lead suit
    return sameSuitCards;
  }

  // 2.B: Player DOES NOT have lead suit -> MUST ruff / trump if they have trump!
  const trumpCards = hand.filter(c => c.suit === trumpSuit);
  if (trumpCards.length > 0) {
    // Check if someone else already played trump in this trick
    const trumpsInTrick = currentTrick.filter(p => p.card.suit === trumpSuit);
    if (trumpsInTrick.length > 0) {
      const highestTrumpValueInTrick = Math.max(
        ...trumpsInTrick.map(p => BATAK_RANK_VALUES[p.card.rank])
      );
      const higherTrumps = trumpCards.filter(c => BATAK_RANK_VALUES[c.rank] > highestTrumpValueInTrick);
      
      // If player has higher trump, must over-trump!
      if (higherTrumps.length > 0) {
        return higherTrumps;
      }
      // If player has no higher trump, standard rule allows playing any card (discard or lower trump)
      return hand;
    }

    // No trump played yet in trick, but player has trump -> Must trump!
    return trumpCards;
  }

  // 2.C: Player has neither lead suit nor trump -> Can discard ANY card
  return hand;
}

// Determine trick winner from the 4 played cards
export function evaluateTrickWinner(
  trick: PlayedCard[],
  trumpSuit: Suit
): { winnerSeat: number; winningCard: Card } {
  if (trick.length === 0) throw new Error('Trick is empty');

  const leadSuit = trick[0].card.suit;
  const trumpPlays = trick.filter(p => p.card.suit === trumpSuit);

  if (trumpPlays.length > 0) {
    // Winner is highest trump
    let highestTrump = trumpPlays[0];
    for (let i = 1; i < trumpPlays.length; i++) {
      if (BATAK_RANK_VALUES[trumpPlays[i].card.rank] > BATAK_RANK_VALUES[highestTrump.card.rank]) {
        highestTrump = trumpPlays[i];
      }
    }
    return { winnerSeat: highestTrump.seatIndex, winningCard: highestTrump.card };
  }

  // No trump played -> Winner is highest card of lead suit
  const leadPlays = trick.filter(p => p.card.suit === leadSuit);
  let highestLead = leadPlays[0];
  for (let i = 1; i < leadPlays.length; i++) {
    if (BATAK_RANK_VALUES[leadPlays[i].card.rank] > BATAK_RANK_VALUES[highestLead.card.rank]) {
      highestLead = leadPlays[i];
    }
  }
  return { winnerSeat: highestLead.seatIndex, winningCard: highestLead.card };
}

// Bot Bidding AI
export function decideBotBatakBid(
  hand: Card[],
  highestBid: number,
  isKozMaca: boolean
): { bid: number; preferredTrump: Suit } {
  const suitCounts: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };
  const suitHighPoints: Record<Suit, number> = { spades: 0, hearts: 0, diamonds: 0, clubs: 0 };

  for (const card of hand) {
    suitCounts[card.suit]++;
    if (card.rank === 'A') suitHighPoints[card.suit] += 4;
    else if (card.rank === 'K') suitHighPoints[card.suit] += 3;
    else if (card.rank === 'Q') suitHighPoints[card.suit] += 2;
    else if (card.rank === 'J') suitHighPoints[card.suit] += 1;
  }

  // Find best trump suit
  let preferredTrump: Suit = 'spades';
  let bestScore = -1;

  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) {
    const score = suitCounts[suit] * 1.5 + suitHighPoints[suit];
    if (score > bestScore) {
      bestScore = score;
      preferredTrump = suit;
    }
  }

  if (isKozMaca) {
    preferredTrump = 'spades';
  }

  // Calculate estimated tricks:
  let estimatedTricks = 0;
  for (const suit of ['spades', 'hearts', 'diamonds', 'clubs'] as Suit[]) {
    const isTrump = suit === preferredTrump;
    const count = suitCounts[suit];
    const points = suitHighPoints[suit];

    if (isTrump) {
      estimatedTricks += Math.max(0, count - 1);
      if (points >= 4) estimatedTricks += 1;
    } else {
      if (hand.some(c => c.suit === suit && c.rank === 'A')) estimatedTricks += 1;
      if (hand.some(c => c.suit === suit && c.rank === 'K') && count >= 2) estimatedTricks += 0.8;
      // Short suit ruffing potential
      if (count === 0 && suitCounts[preferredTrump] >= 4) estimatedTricks += 1;
    }
  }

  const estimated = Math.floor(estimatedTricks);

  if (isKozMaca) {
    return { bid: Math.max(1, Math.min(13, estimated)), preferredTrump: 'spades' };
  }

  // İhaleli Batak: Minimum bid is 5
  if (estimated >= 5 && estimated > highestBid) {
    return { bid: Math.min(estimated, 11), preferredTrump };
  }

  return { bid: 0, preferredTrump }; // Pas
}

// Bot Card Play AI
export function decideBotBatakCard(
  hand: Card[],
  currentTrick: PlayedCard[],
  trumpSuit: Suit,
  isTrumpBroken: boolean,
  botBid: number,
  tricksWon: number
): Card {
  const validCards = getValidBatakCards(hand, currentTrick, trumpSuit, isTrumpBroken);
  if (validCards.length === 1) return validCards[0];

  // If leading
  if (currentTrick.length === 0) {
    // If bot has already reached their bid and wants to stay safe, play low card
    if (botBid > 0 && tricksWon >= botBid) {
      const nonTrumps = validCards.filter(c => c.suit !== trumpSuit);
      const list = nonTrumps.length > 0 ? nonTrumps : validCards;
      return list.sort((a, b) => BATAK_RANK_VALUES[a.rank] - BATAK_RANK_VALUES[b.rank])[0];
    }

    // Lead with Aces in side suits first
    const sideAces = validCards.filter(c => c.suit !== trumpSuit && c.rank === 'A');
    if (sideAces.length > 0) return sideAces[0];

    // Lead with high card of longest suit
    return validCards.sort((a, b) => BATAK_RANK_VALUES[b.rank] - BATAK_RANK_VALUES[a.rank])[0];
  }

  // Responding to lead:
  const leadSuit = currentTrick[0].card.suit;
  const currentWinner = evaluateTrickWinner(currentTrick, trumpSuit);

  // Check which valid cards can win this trick
  const winningCards: Card[] = [];
  const losingCards: Card[] = [];

  for (const card of validCards) {
    const simTrick = [...currentTrick, { seatIndex: 99, card }];
    const simWinner = evaluateTrickWinner(simTrick, trumpSuit);
    if (simWinner.winnerSeat === 99) {
      winningCards.push(card);
    } else {
      losingCards.push(card);
    }
  }

  // If bot wants to win and can win: play lowest winning card
  if (winningCards.length > 0 && (botBid === 0 || tricksWon < botBid + 2)) {
    return winningCards.sort((a, b) => BATAK_RANK_VALUES[a.rank] - BATAK_RANK_VALUES[b.rank])[0];
  }

  // If cannot win or doesn't want to win: play lowest losing card
  if (losingCards.length > 0) {
    return losingCards.sort((a, b) => BATAK_RANK_VALUES[a.rank] - BATAK_RANK_VALUES[b.rank])[0];
  }

  return validCards[0];
}

// Initialize Batak 4-player Table
export function initializeBatakTable(
  id: string,
  title: string,
  hostId: number,
  hostUsername: string,
  hostAvatar?: string | null,
  hostColor?: string | null,
  gameMode: BatakGameMode = 'ihale'
): BatakState {
  const [h0, h1, h2, h3] = dealBatakHands();

  const players: BatakPlayer[] = [
    {
      seatIndex: 0,
      userId: hostId,
      username: hostUsername,
      avatar: hostAvatar,
      color: hostColor,
      isBot: false,
      hand: h0,
      bid: -1,
      tricksWon: 0,
      score: 0,
      totalScore: 0,
      isReady: true,
      isBiddingFinished: false
    },
    {
      seatIndex: 1,
      username: 'Bot Mert',
      isBot: true,
      hand: h1,
      bid: -1,
      tricksWon: 0,
      score: 0,
      totalScore: 0,
      isReady: true,
      isBiddingFinished: false
    },
    {
      seatIndex: 2,
      username: 'Bot Zeynep',
      isBot: true,
      hand: h2,
      bid: -1,
      tricksWon: 0,
      score: 0,
      totalScore: 0,
      isReady: true,
      isBiddingFinished: false
    },
    {
      seatIndex: 3,
      username: 'Bot Kaan',
      isBot: true,
      hand: h3,
      bid: -1,
      tricksWon: 0,
      score: 0,
      totalScore: 0,
      isReady: true,
      isBiddingFinished: false
    }
  ];

  return {
    id,
    title,
    hostId,
    gameMode,
    targetRounds: 5,
    currentRound: 1,
    phase: 'BIDDING',
    players,
    dealerSeat: 0,
    bidWinnerSeat: null,
    highestBid: gameMode === 'ihale' ? 4 : 0,
    trumpSuit: gameMode === 'koz_maca' ? 'spades' : null,
    isTrumpBroken: false,
    currentTrick: [],
    turnSeatIndex: 1, // First bidder is after dealer
    trickWinnerSeat: null,
    leadSuit: null,
    tricksHistory: [],
    roundScores: [],
    history: ['Yeni Batak eli başladı. İhale sırası dağıtıcıdan sonraki oyuncuda.']
  };
}

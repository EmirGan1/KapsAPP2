import { Card, Suit, Rank } from '../components/PlayingCard';

export const ALL_SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
export const ALL_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Rank order for Batak: 2 < 3 < ... < 10 < J < Q < K < A
export const BATAK_RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 11,
  'Q': 12,
  'K': 13,
  'A': 14
};

// Create a pristine 52-card standard deck
export function createStandardDeck(deckCount = 1): Card[] {
  const cards: Card[] = [];
  for (let d = 0; d < deckCount; d++) {
    for (const suit of ALL_SUITS) {
      for (const rank of ALL_RANKS) {
        cards.push({
          suit,
          rank,
          id: `${suit}_${rank}_${d}_${Math.random().toString(36).substring(2, 7)}`
        });
      }
    }
  }
  return cards;
}

// Fisher-Yates pure in-place / copy shuffle
export function shuffleDeck<T>(deck: T[]): T[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Convert card to unique readable string (e.g. "spades_A")
export function cardToString(card: Card): string {
  return `${card.suit}_${card.rank}`;
}

export function parseCardString(str: string): Card {
  const [suit, rank] = str.split('_') as [Suit, Rank];
  return { suit, rank, id: str };
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge catalog — single source of truth for the rewards system.
//
// Earned status & progress are computed live on the client from the raw metrics
// returned by GET /api/users/me/stats (no badges are stored server-side). Each
// badge maps to one metric + a threshold; rating badges additionally gate on a
// minimum number of reviews so a single 5★ doesn't unlock a "perfect average".
// ─────────────────────────────────────────────────────────────────────────────

/** Raw per-user metrics from the backend (all default to 0). */
export interface BadgeStats {
  purchasedTours: number;
  minutesOwned: number;
  placesExplored: number;
  reviewsWritten: number;
  toursCreated: number;
  creatorMinutes: number;
  toursSold: number;
  earningsCents: number;
  ratingCount: number;
  avgRating: number;
  maxStops: number;
  audienceCountries: number;
  languagesOffered: number;
  translationJobs: number;
  accountAgeDays: number;
}

export type BadgeMetric = keyof BadgeStats;
export type BadgeCategory = 'explorer' | 'loyalty' | 'creator' | 'translator';

export interface BadgeDef {
  id: string;
  name: string;            // funny historical name
  category: BadgeCategory;
  /** Motif key rendered by <app-badge-icon>. */
  icon: string;
  /** Short text shown inside the badge (e.g. "5", "10h", "€500", "5.0★"). */
  label: string;
  /** One-line "how to earn it". */
  hint: string;
  metric: BadgeMetric;
  threshold: number;
  /** Optional sample-size gate (used by rating badges). */
  min?: { metric: BadgeMetric; value: number };
  /** Per-badge background gradient [from, to] (assigned below). */
  gradient: [string, string];
}

export interface BadgeStatus {
  def: BadgeDef;
  earned: boolean;
  /** 0–1 progress toward the threshold. */
  progress: number;
}

export const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  explorer:   'Explorer',
  loyalty:    'Loyalty',
  creator:    'Creator',
  translator: 'Translator',
};

const RAW_BADGES: Omit<BadgeDef, 'gradient'>[] = [
  // ── Explorer: tours owned ────────────────────────────────────────────────
  { id: 'pliny',       name: 'Pliny the Curious', category: 'explorer', icon: 'ticket', label: '1',   hint: 'Buy your first tour.',                  metric: 'purchasedTours', threshold: 1 },
  { id: 'herodotus',   name: 'Herodotus',         category: 'explorer', icon: 'ticket', label: '5',   hint: 'Own 5 tours.',                          metric: 'purchasedTours', threshold: 5 },
  { id: 'ibn-battuta', name: 'Ibn Battuta',       category: 'explorer', icon: 'ticket', label: '15',  hint: 'Own 15 tours.',                         metric: 'purchasedTours', threshold: 15 },
  { id: 'odysseus',    name: 'Odysseus',          category: 'explorer', icon: 'ticket', label: '30',  hint: 'Own 30 tours.',                         metric: 'purchasedTours', threshold: 30 },
  { id: 'cook',        name: 'Captain Cook',      category: 'explorer', icon: 'ticket', label: '50',  hint: 'Own 50 tours.',                         metric: 'purchasedTours', threshold: 50 },

  // ── Explorer: different places ───────────────────────────────────────────
  { id: 'marco-polo',  name: 'Marco Polo',        category: 'explorer', icon: 'compass', label: '3',  hint: 'Own tours in 3 different places.',      metric: 'placesExplored', threshold: 3 },
  { id: 'magellan',    name: 'Magellan',          category: 'explorer', icon: 'compass', label: '8',  hint: 'Own tours in 8 different places.',      metric: 'placesExplored', threshold: 8 },
  { id: 'phileas-fogg',name: 'Phileas Fogg',      category: 'explorer', icon: 'compass', label: '20', hint: 'Own tours in 20 different places.',     metric: 'placesExplored', threshold: 20 },

  // ── Explorer: hours of tours owned ───────────────────────────────────────
  { id: 'scheherazade',name: 'Scheherazade',      category: 'explorer', icon: 'headphones', label: '1h',  hint: 'Own 1 hour of tours.',             metric: 'minutesOwned', threshold: 60 },
  { id: 'homer',       name: 'Homer',             category: 'explorer', icon: 'headphones', label: '5h',  hint: 'Own 5 hours of tours.',            metric: 'minutesOwned', threshold: 300 },
  { id: 'wagner',      name: 'Richard Wagner',    category: 'explorer', icon: 'headphones', label: '10h', hint: 'Own 10 hours of tours.',           metric: 'minutesOwned', threshold: 600 },
  { id: 'proust',      name: 'Marcel Proust',     category: 'explorer', icon: 'headphones', label: '25h', hint: 'Own 25 hours of tours.',           metric: 'minutesOwned', threshold: 1500 },

  // ── Explorer: reviews written ────────────────────────────────────────────
  { id: 'aristotle',   name: 'Aristotle',         category: 'explorer', icon: 'quill-star', label: '1',  hint: 'Write your first review.',          metric: 'reviewsWritten', threshold: 1 },
  { id: 'vasari',      name: 'Giorgio Vasari',    category: 'explorer', icon: 'quill-star', label: '10', hint: 'Write 10 reviews.',                metric: 'reviewsWritten', threshold: 10 },
  { id: 'ruskin',      name: 'John Ruskin',       category: 'explorer', icon: 'quill-star', label: '25', hint: 'Write 25 reviews.',                metric: 'reviewsWritten', threshold: 25 },

  // ── Loyalty: account age ─────────────────────────────────────────────────
  { id: 'adam',        name: 'Adam',              category: 'loyalty', icon: 'hourglass', label: 'Day 1', hint: 'Join Constantine.',               metric: 'accountAgeDays', threshold: 0 },
  { id: 'nestor',      name: 'Nestor',            category: 'loyalty', icon: 'hourglass', label: '6mo',   hint: 'Be a member for 6 months.',       metric: 'accountAgeDays', threshold: 180 },
  { id: 'methuselah',  name: 'Methuselah',        category: 'loyalty', icon: 'hourglass', label: '1yr',   hint: 'Be a member for a year.',         metric: 'accountAgeDays', threshold: 365 },

  // ── Creator: tours published ─────────────────────────────────────────────
  { id: 'gutenberg',   name: 'Gutenberg',         category: 'creator', icon: 'quill', label: '1',  hint: 'Publish your first tour.',              metric: 'toursCreated', threshold: 1 },
  { id: 'cervantes',   name: 'Cervantes',         category: 'creator', icon: 'quill', label: '5',  hint: 'Publish 5 tours.',                      metric: 'toursCreated', threshold: 5 },
  { id: 'dante',       name: 'Dante Alighieri',   category: 'creator', icon: 'quill', label: '10', hint: 'Publish 10 tours.',                     metric: 'toursCreated', threshold: 10 },
  { id: 'shakespeare', name: 'Shakespeare',       category: 'creator', icon: 'quill', label: '25', hint: 'Publish 25 tours.',                     metric: 'toursCreated', threshold: 25 },

  // ── Creator: hours produced ──────────────────────────────────────────────
  { id: 'aesop',       name: 'Aesop',             category: 'creator', icon: 'mic', label: '1h',  hint: 'Produce 1 hour of tours.',               metric: 'creatorMinutes', threshold: 60 },
  { id: 'boccaccio',   name: 'Boccaccio',         category: 'creator', icon: 'mic', label: '5h',  hint: 'Produce 5 hours of tours.',              metric: 'creatorMinutes', threshold: 300 },
  { id: 'tolstoy',     name: 'Leo Tolstoy',       category: 'creator', icon: 'mic', label: '20h', hint: 'Produce 20 hours of tours.',             metric: 'creatorMinutes', threshold: 1200 },

  // ── Creator: tours sold ──────────────────────────────────────────────────
  { id: 'town-crier',  name: 'Town Crier',        category: 'creator', icon: 'tag', label: '1',   hint: 'Make your first sale.',                 metric: 'toursSold', threshold: 1 },
  { id: 'paine',       name: 'Thomas Paine',      category: 'creator', icon: 'tag', label: '25',  hint: 'Sell 25 tours.',                        metric: 'toursSold', threshold: 25 },
  { id: 'caesar',      name: 'Julius Caesar',     category: 'creator', icon: 'tag', label: '100', hint: 'Sell 100 tours.',                       metric: 'toursSold', threshold: 100 },
  { id: 'alexander',   name: 'Alexander the Great',category: 'creator', icon: 'tag', label: '500', hint: 'Sell 500 tours.',                      metric: 'toursSold', threshold: 500 },

  // ── Creator: earnings ────────────────────────────────────────────────────
  { id: 'florin',      name: 'The First Florin',  category: 'creator', icon: 'coin', label: '€1',   hint: 'Earn your first euro.',               metric: 'earningsCents', threshold: 100 },
  { id: 'croesus',     name: 'Croesus',           category: 'creator', icon: 'coin', label: '€50',  hint: 'Earn €50.',                          metric: 'earningsCents', threshold: 5000 },
  { id: 'medici',      name: 'House of Medici',    category: 'creator', icon: 'coin', label: '€500', hint: 'Earn €500.',                         metric: 'earningsCents', threshold: 50000 },
  { id: 'mansa-musa',  name: 'Mansa Musa',        category: 'creator', icon: 'coin', label: '€2k',  hint: 'Earn €2,000.',                       metric: 'earningsCents', threshold: 200000 },

  // ── Creator: average rating (gated on review count) ──────────────────────
  { id: 'praxiteles',  name: 'Praxiteles',        category: 'creator', icon: 'laurel', label: '4.0★', hint: 'Hold a 4.0★ average (3+ reviews).',  metric: 'avgRating', threshold: 4.0, min: { metric: 'ratingCount', value: 3 } },
  { id: 'michelangelo',name: 'Michelangelo',      category: 'creator', icon: 'laurel', label: '4.5★', hint: 'Hold a 4.5★ average (5+ reviews).',  metric: 'avgRating', threshold: 4.5, min: { metric: 'ratingCount', value: 5 } },
  { id: 'leonardo',    name: 'Leonardo da Vinci', category: 'creator', icon: 'laurel', label: '5.0★', hint: 'Hold a perfect 5★ average (5+ reviews).', metric: 'avgRating', threshold: 5.0, min: { metric: 'ratingCount', value: 5 } },

  // ── Creator: craft ───────────────────────────────────────────────────────
  { id: 'mercator',    name: 'Gerardus Mercator', category: 'creator', icon: 'route',  label: '10', hint: 'Build a tour with 10+ stops.',         metric: 'maxStops', threshold: 10 },
  { id: 'genghis',     name: 'Genghis Khan',      category: 'creator', icon: 'globe',  label: '10', hint: 'Sell tours in 10+ countries.',         metric: 'audienceCountries', threshold: 10 },
  { id: 'cleopatra',   name: 'Cleopatra',         category: 'creator', icon: 'speech', label: '5',  hint: 'Offer your tours in 5+ languages.',     metric: 'languagesOffered', threshold: 5 },

  // ── Translator ───────────────────────────────────────────────────────────
  { id: 'saint-jerome',name: 'Saint Jerome',      category: 'translator', icon: 'book', label: '1',  hint: 'Complete a translation job.',          metric: 'translationJobs', threshold: 1 },
];

/**
 * A self-made "wide palette": each badge gets a distinct hue spread evenly
 * around the colour wheel, rendered as a soft pastel gradient so the black
 * line-art motif stays legible on top.
 */
function makeGradient(index: number, total: number): [string, string] {
  const hue = Math.round((index * 360) / total);
  return [`hsl(${hue}, 70%, 90%)`, `hsl(${(hue + 26) % 360}, 64%, 75%)`];
}

export const BADGES: BadgeDef[] = RAW_BADGES.map((b, i) => ({
  ...b,
  gradient: makeGradient(i, RAW_BADGES.length),
}));

/** Compute earned status + progress for a single badge. */
export function badgeStatus(def: BadgeDef, stats: BadgeStats | null): BadgeStatus {
  if (!stats) return { def, earned: false, progress: 0 };
  const value = stats[def.metric] ?? 0;
  const gateOk = !def.min || (stats[def.min.metric] ?? 0) >= def.min.value;
  const earned = gateOk && value >= def.threshold;
  const progress = def.threshold <= 0 ? 1 : Math.max(0, Math.min(1, value / def.threshold));
  return { def, earned, progress };
}

/** Compute status for every badge. */
export function allBadgeStatuses(stats: BadgeStats | null): BadgeStatus[] {
  return BADGES.map(def => badgeStatus(def, stats));
}

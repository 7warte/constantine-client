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
  /** One sentence about the historical figure (shown in the info popup). */
  blurb?: string;
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
  // ── Explorer: different places (compass) ─────────────────────────────────
  { id: 'marco-polo', name: 'Marco Polo', category: 'explorer', icon: 'compass', label: '3', hint: 'Own tours set in 3 different places.', blurb: 'Venetian merchant whose 13th-century travels to Kublai Khan’s China shaped Europe’s image of Asia.', metric: 'placesExplored', threshold: 3 },
  { id: 'herodotus', name: 'Herodotus', category: 'explorer', icon: 'compass', label: '5', hint: 'Own tours set in 5 different places.', blurb: 'Greek historian of the 5th century BC, traditionally called the Father of History.', metric: 'placesExplored', threshold: 5 },
  { id: 'ibn-battuta', name: 'Ibn Battuta', category: 'explorer', icon: 'compass', label: '10', hint: 'Own tours set in 10 different places.', blurb: 'Medieval Moroccan scholar who journeyed across Africa, Asia and Europe for nearly thirty years.', metric: 'placesExplored', threshold: 10 },
  { id: 'odysseus', name: 'Odysseus', category: 'explorer', icon: 'compass', label: '15', hint: 'Own tours set in 15 different places.', blurb: 'Legendary Greek king of Ithaca whose decade-long voyage home is told in Homer’s Odyssey.', metric: 'placesExplored', threshold: 15 },
  { id: 'cook', name: 'Captain Cook', category: 'explorer', icon: 'compass', label: '20', hint: 'Own tours set in 20 different places.', blurb: 'British navigator who charted the Pacific and reached Australia and Hawaii in the 18th century.', metric: 'placesExplored', threshold: 20 },
  { id: 'magellan', name: 'Ferdinand Magellan', category: 'explorer', icon: 'compass', label: '30', hint: 'Own tours set in 30 different places.', blurb: 'Portuguese explorer whose expedition first circumnavigated the globe in the early 16th century.', metric: 'placesExplored', threshold: 30 },
  { id: 'zheng-he', name: 'Zheng He', category: 'explorer', icon: 'compass', label: '40', hint: 'Own tours set in 40 different places.', blurb: 'Ming dynasty admiral who led vast treasure fleets across the Indian Ocean in the 15th century.', metric: 'placesExplored', threshold: 40 },
  { id: 'phileas-fogg', name: 'Phileas Fogg', category: 'explorer', icon: 'compass', label: '50', hint: 'Own tours set in 50 different places.', blurb: 'Verne’s unflappable hero who wagered he could circle the world in eighty days.', metric: 'placesExplored', threshold: 50 },

  // ── Explorer: tours owned (ticket) ───────────────────────────────────────
  { id: 'pliny', name: 'Pliny the Curious', category: 'explorer', icon: 'ticket', label: '1', hint: 'Buy your very first tour.', blurb: 'Roman naturalist whose insatiable curiosity filled the encyclopedic Natural History.', metric: 'purchasedTours', threshold: 1 },
  { id: 'pausanias', name: 'Pausanias', category: 'explorer', icon: 'ticket', label: '3', hint: 'Buy 3 tours in total.', blurb: 'Greek geographer whose Description of Greece guided ancient travellers through its monuments.', metric: 'purchasedTours', threshold: 3 },
  { id: 'xenophon', name: 'Xenophon', category: 'explorer', icon: 'ticket', label: '5', hint: 'Buy 5 tours in total.', blurb: 'Athenian soldier-writer who chronicled the long march of ten thousand Greeks home from Persia.', metric: 'purchasedTours', threshold: 5 },
  { id: 'strabo', name: 'Strabo', category: 'explorer', icon: 'ticket', label: '10', hint: 'Buy 10 tours in total.', blurb: 'Greek geographer whose seventeen-volume Geographica surveyed the known world of the Roman era.', metric: 'purchasedTours', threshold: 10 },
  { id: 'egeria', name: 'Egeria', category: 'explorer', icon: 'ticket', label: '25', hint: 'Buy 25 tours in total.', blurb: 'Fourth-century pilgrim whose travel diary records an arduous journey to the Holy Land.', metric: 'purchasedTours', threshold: 25 },
  { id: 'fa-xian', name: 'Faxian', category: 'explorer', icon: 'ticket', label: '50', hint: 'Buy 50 tours in total.', blurb: 'Chinese monk who walked to India in the 5th century seeking Buddhist scriptures.', metric: 'purchasedTours', threshold: 50 },
  { id: 'vespucci', name: 'Amerigo Vespucci', category: 'explorer', icon: 'ticket', label: '75', hint: 'Buy 75 tours in total.', blurb: 'Italian navigator whose voyages led mapmakers to name the New World America.', metric: 'purchasedTours', threshold: 75 },
  { id: 'humboldt', name: 'Alexander von Humboldt', category: 'explorer', icon: 'ticket', label: '100', hint: 'Buy 100 tours in total.', blurb: 'Prussian polymath whose American expeditions founded modern physical geography and ecology.', metric: 'purchasedTours', threshold: 100 },
  { id: 'livingstone', name: 'David Livingstone', category: 'explorer', icon: 'ticket', label: '250', hint: 'Buy 250 tours in total.', blurb: 'Scottish missionary-explorer who mapped much of central Africa in the 19th century.', metric: 'purchasedTours', threshold: 250 },

  // ── Explorer: hours owned (headphones) ───────────────────────────────────
  { id: 'scheherazade', name: 'Scheherazade', category: 'explorer', icon: 'headphones', label: '1h', hint: 'Own one hour of tour audio.', blurb: 'Storytelling queen of the Thousand and One Nights who spun tales to stay alive.', metric: 'minutesOwned', threshold: 60 },
  { id: 'homer', name: 'Homer', category: 'explorer', icon: 'headphones', label: '5h', hint: 'Own five hours of tour audio.', blurb: 'Ancient Greek poet credited with composing the epic Iliad and Odyssey.', metric: 'minutesOwned', threshold: 300 },
  { id: 'wagner', name: 'Richard Wagner', category: 'explorer', icon: 'headphones', label: '10h', hint: 'Own ten hours of tour audio.', blurb: 'German composer whose monumental operas reshaped 19th-century music and theatre.', metric: 'minutesOwned', threshold: 600 },
  { id: 'proust', name: 'Marcel Proust', category: 'explorer', icon: 'headphones', label: '25h', hint: 'Own twenty-five hours of tour audio.', blurb: 'French novelist whose vast In Search of Lost Time explores memory and time.', metric: 'minutesOwned', threshold: 1500 },
  { id: 'beethoven', name: 'Ludwig van Beethoven', category: 'explorer', icon: 'headphones', label: '50h', hint: 'Own fifty hours of tour audio.', blurb: 'German composer who bridged Classical and Romantic eras despite losing his hearing.', metric: 'minutesOwned', threshold: 3000 },
  { id: 'bach', name: 'Johann Sebastian Bach', category: 'explorer', icon: 'headphones', label: '100h', hint: 'Own one hundred hours of tour audio.', blurb: 'Baroque German composer whose intricate counterpoint remains a pinnacle of Western music.', metric: 'minutesOwned', threshold: 6000 },
  { id: 'mozart', name: 'Wolfgang Amadeus Mozart', category: 'explorer', icon: 'headphones', label: '200h', hint: 'Own two hundred hours of tour audio.', blurb: 'Austrian prodigy who composed over six hundred works before dying at thirty-five.', metric: 'minutesOwned', threshold: 12000 },

  // ── Explorer: reviews written (quill-star) ───────────────────────────────
  { id: 'aristotle', name: 'Aristotle', category: 'explorer', icon: 'quill-star', label: '1', hint: 'Write your first tour review.', blurb: 'Greek philosopher whose writings on logic, ethics and nature shaped Western thought.', metric: 'reviewsWritten', threshold: 1 },
  { id: 'vasari', name: 'Giorgio Vasari', category: 'explorer', icon: 'quill-star', label: '3', hint: 'Write 3 tour reviews.', blurb: 'Italian painter whose Lives of the Artists founded the discipline of art history.', metric: 'reviewsWritten', threshold: 3 },
  { id: 'ruskin', name: 'John Ruskin', category: 'explorer', icon: 'quill-star', label: '5', hint: 'Write 5 tour reviews.', blurb: 'Victorian critic whose writings on art and architecture shaped 19th-century taste.', metric: 'reviewsWritten', threshold: 5 },
  { id: 'pepys', name: 'Samuel Pepys', category: 'explorer', icon: 'quill-star', label: '10', hint: 'Write 10 tour reviews.', blurb: 'English official whose candid diary vividly records 1660s London life.', metric: 'reviewsWritten', threshold: 10 },
  { id: 'johnson', name: 'Samuel Johnson', category: 'explorer', icon: 'quill-star', label: '25', hint: 'Write 25 tour reviews.', blurb: 'English writer who compiled a landmark dictionary and dominated 18th-century letters.', metric: 'reviewsWritten', threshold: 25 },
  { id: 'sainte-beuve', name: 'Sainte-Beuve', category: 'explorer', icon: 'quill-star', label: '50', hint: 'Write 50 tour reviews.', blurb: 'French critic regarded as a founding figure of modern literary criticism.', metric: 'reviewsWritten', threshold: 50 },
  { id: 'addison', name: 'Joseph Addison', category: 'explorer', icon: 'quill-star', label: '100', hint: 'Write 100 tour reviews.', blurb: 'English essayist whose Spectator pieces refined the periodical and public taste.', metric: 'reviewsWritten', threshold: 100 },

  // ── Loyalty: account age (hourglass) ─────────────────────────────────────
  { id: 'adam', name: 'Adam', category: 'loyalty', icon: 'hourglass', label: 'Day 1', hint: 'Join Constantine and open your account.', blurb: 'The first man in the Abrahamic traditions, named at the very beginning of creation.', metric: 'accountAgeDays', threshold: 0 },
  { id: 'enoch', name: 'Enoch', category: 'loyalty', icon: 'hourglass', label: '1wk', hint: 'Keep your account for one week.', blurb: 'Biblical patriarch said to have walked with God before being taken to heaven.', metric: 'accountAgeDays', threshold: 7 },
  { id: 'nestor', name: 'Nestor', category: 'loyalty', icon: 'hourglass', label: '1mo', hint: 'Keep your account for one month.', blurb: 'Aged Greek king of Pylos famed in Homer for his long life and wise counsel.', metric: 'accountAgeDays', threshold: 30 },
  { id: 'tithonus', name: 'Tithonus', category: 'loyalty', icon: 'hourglass', label: '3mo', hint: 'Keep your account for three months.', blurb: 'Trojan prince granted endless life by the gods, but not eternal youth.', metric: 'accountAgeDays', threshold: 90 },
  { id: 'sibyl', name: 'The Cumaean Sibyl', category: 'loyalty', icon: 'hourglass', label: '6mo', hint: 'Keep your account for six months.', blurb: 'Ancient prophetess granted as many years of life as grains of sand she held.', metric: 'accountAgeDays', threshold: 180 },
  { id: 'noah', name: 'Noah', category: 'loyalty', icon: 'hourglass', label: '1yr', hint: 'Keep your account for one year.', blurb: 'Biblical patriarch who built the ark and was said to live over nine centuries.', metric: 'accountAgeDays', threshold: 365 },
  { id: 'jared', name: 'Jared', category: 'loyalty', icon: 'hourglass', label: '2yr', hint: 'Keep your account for two years.', blurb: 'Antediluvian patriarch of Genesis credited with a lifespan of 962 years.', metric: 'accountAgeDays', threshold: 730 },
  { id: 'laozi', name: 'Laozi', category: 'loyalty', icon: 'hourglass', label: '3yr', hint: 'Keep your account for three years.', blurb: 'Semi-legendary Chinese sage and founder of Daoism, reputed to have lived extraordinarily long.', metric: 'accountAgeDays', threshold: 1095 },
  { id: 'methuselah', name: 'Methuselah', category: 'loyalty', icon: 'hourglass', label: '5yr', hint: 'Keep your account for five years.', blurb: 'Biblical patriarch whose 969 years make him the longest-lived figure in scripture.', metric: 'accountAgeDays', threshold: 1825 },
  { id: 'tiresias', name: 'Tiresias', category: 'loyalty', icon: 'hourglass', label: '10yr', hint: 'Keep your account for ten years.', blurb: 'Blind Theban seer of Greek myth said to have lived across seven generations.', metric: 'accountAgeDays', threshold: 3650 },

  // ── Creator: tours published (quill) ─────────────────────────────────────
  { id: 'gutenberg', name: 'Johannes Gutenberg', category: 'creator', icon: 'quill', label: '1', hint: 'Publish your first tour.', blurb: 'German inventor whose movable-type printing press launched the European print revolution.', metric: 'toursCreated', threshold: 1 },
  { id: 'aesop', name: 'Aesop', category: 'creator', icon: 'quill', label: '3', hint: 'Publish 3 tours.', blurb: 'Ancient Greek storyteller whose short fables carry enduring moral lessons.', metric: 'toursCreated', threshold: 3 },
  { id: 'dante', name: 'Dante Alighieri', category: 'creator', icon: 'quill', label: '5', hint: 'Publish 5 tours.', blurb: 'Florentine poet whose Divine Comedy is a cornerstone of Italian literature.', metric: 'toursCreated', threshold: 5 },
  { id: 'boccaccio', name: 'Giovanni Boccaccio', category: 'creator', icon: 'quill', label: '10', hint: 'Publish 10 tours.', blurb: 'Italian writer whose Decameron framed a hundred tales told during the plague.', metric: 'toursCreated', threshold: 10 },
  { id: 'cervantes', name: 'Miguel de Cervantes', category: 'creator', icon: 'quill', label: '25', hint: 'Publish 25 tours.', blurb: 'Spanish author of Don Quixote, often called the first modern novel.', metric: 'toursCreated', threshold: 25 },
  { id: 'shakespeare', name: 'William Shakespeare', category: 'creator', icon: 'quill', label: '50', hint: 'Publish 50 tours.', blurb: 'English playwright and poet widely regarded as the greatest writer in the language.', metric: 'toursCreated', threshold: 50 },
  { id: 'tolstoy', name: 'Leo Tolstoy', category: 'creator', icon: 'quill', label: '75', hint: 'Publish 75 tours.', blurb: 'Russian novelist whose War and Peace and Anna Karenina define epic realism.', metric: 'toursCreated', threshold: 75 },
  { id: 'lope-de-vega', name: 'Lope de Vega', category: 'creator', icon: 'quill', label: '100', hint: 'Publish 100 tours.', blurb: 'Prolific Spanish dramatist who reputedly wrote hundreds of plays for the Golden Age stage.', metric: 'toursCreated', threshold: 100 },

  // ── Creator: hours produced (mic) ────────────────────────────────────────
  { id: 'town-crier', name: 'Town Crier', category: 'creator', icon: 'mic', label: '1h', hint: 'Publish one hour of audio.', blurb: 'Public official who once announced news and proclamations aloud in the town square.', metric: 'creatorMinutes', threshold: 60 },
  { id: 'cicero', name: 'Cicero', category: 'creator', icon: 'mic', label: '5h', hint: 'Publish five hours of audio.', blurb: 'Roman statesman and orator whose speeches set the standard for Latin eloquence.', metric: 'creatorMinutes', threshold: 300 },
  { id: 'demosthenes', name: 'Demosthenes', category: 'creator', icon: 'mic', label: '10h', hint: 'Publish ten hours of audio.', blurb: 'Athenian orator who overcame a speech impediment to become Greece’s finest public speaker.', metric: 'creatorMinutes', threshold: 600 },
  { id: 'chrysostom', name: 'John Chrysostom', category: 'creator', icon: 'mic', label: '25h', hint: 'Publish twenty-five hours of audio.', blurb: 'Early church father nicknamed the golden-mouthed for his eloquent preaching.', metric: 'creatorMinutes', threshold: 1500 },
  { id: 'churchill', name: 'Winston Churchill', category: 'creator', icon: 'mic', label: '50h', hint: 'Publish fifty hours of audio.', blurb: 'British wartime prime minister whose stirring broadcasts rallied a nation in 1940.', metric: 'creatorMinutes', threshold: 3000 },
  { id: 'rhapsode', name: 'Homer the Rhapsode', category: 'creator', icon: 'mic', label: '100h', hint: 'Publish one hundred hours of audio.', blurb: 'The wandering bard tradition that recited the great epics aloud across ancient Greece.', metric: 'creatorMinutes', threshold: 6000 },

  // ── Creator: tours sold (tag) ────────────────────────────────────────────
  { id: 'florin', name: 'The First Florin', category: 'creator', icon: 'tag', label: '1', hint: 'Sell your first tour.', blurb: 'The gold coin of medieval Florence that became Europe’s trusted standard of trade.', metric: 'toursSold', threshold: 1 },
  { id: 'fugger-merchant', name: 'Jakob Fugger', category: 'creator', icon: 'tag', label: '10', hint: 'Sell 10 tours.', blurb: 'Augsburg merchant-banker who became one of the wealthiest men of Renaissance Europe.', metric: 'toursSold', threshold: 10 },
  { id: 'datini', name: 'Francesco Datini', category: 'creator', icon: 'tag', label: '25', hint: 'Sell 25 tours.', blurb: 'Medieval Tuscan merchant whose vast archive illuminates 14th-century commerce.', metric: 'toursSold', threshold: 25 },
  { id: 'cosimo', name: 'Cosimo de’ Medici', category: 'creator', icon: 'tag', label: '50', hint: 'Sell 50 tours.', blurb: 'Florentine banker whose financial empire underwrote the city’s Renaissance flowering.', metric: 'toursSold', threshold: 50 },
  { id: 'whittington', name: 'Richard Whittington', category: 'creator', icon: 'tag', label: '100', hint: 'Sell 100 tours.', blurb: 'Medieval London mercer and four-time Lord Mayor immortalised in English folklore.', metric: 'toursSold', threshold: 100 },
  { id: 'astor', name: 'John Jacob Astor', category: 'creator', icon: 'tag', label: '250', hint: 'Sell 250 tours.', blurb: 'German-American merchant whose fur and real-estate empire made him America’s first multimillionaire.', metric: 'toursSold', threshold: 250 },
  { id: 'rothschild', name: 'Nathan Rothschild', category: 'creator', icon: 'tag', label: '500', hint: 'Sell 500 tours.', blurb: 'London financier whose banking house dominated 19th-century European finance.', metric: 'toursSold', threshold: 500 },
  { id: 'niccolo-polo', name: 'Niccolò Polo', category: 'creator', icon: 'tag', label: '1k', hint: 'Sell 1,000 tours.', blurb: 'Venetian trader and father of Marco Polo who pioneered the family’s eastern ventures.', metric: 'toursSold', threshold: 1000 },
  { id: 'paine', name: 'Thomas Paine', category: 'creator', icon: 'tag', label: '2k', hint: 'Sell 2,000 tours.', blurb: 'Anglo-American pamphleteer whose Common Sense galvanised the American Revolution.', metric: 'toursSold', threshold: 2000 },

  // ── Creator: earnings (coin) ─────────────────────────────────────────────
  { id: 'widows-mite', name: 'The Widow’s Mite', category: 'creator', icon: 'coin', label: '€1', hint: 'Earn your first euro.', blurb: 'The smallest coin of the Gospels, praised as a gift greater than the rich gave.', metric: 'earningsCents', threshold: 100 },
  { id: 'denarius', name: 'The Denarius', category: 'creator', icon: 'coin', label: '€10', hint: 'Earn 10 euros.', blurb: 'The standard silver coin that paid Roman soldiers and oiled the empire’s economy.', metric: 'earningsCents', threshold: 1000 },
  { id: 'ducat', name: 'The Venetian Ducat', category: 'creator', icon: 'coin', label: '€50', hint: 'Earn 50 euros.', blurb: 'Pure-gold coin of Venice that circulated as international money for centuries.', metric: 'earningsCents', threshold: 5000 },
  { id: 'gold-florin', name: 'The Gold Florin', category: 'creator', icon: 'coin', label: '€100', hint: 'Earn 100 euros.', blurb: 'Florence’s gold coin whose reliability made it the benchmark of medieval trade.', metric: 'earningsCents', threshold: 10000 },
  { id: 'croesus', name: 'Croesus', category: 'creator', icon: 'coin', label: '€500', hint: 'Earn 500 euros.', blurb: 'Lydian king whose legendary wealth gave rise to the phrase rich as Croesus.', metric: 'earningsCents', threshold: 50000 },
  { id: 'medici', name: 'House of Medici', category: 'creator', icon: 'coin', label: '€1k', hint: 'Earn 1,000 euros.', blurb: 'Florentine dynasty of bankers and patrons who bankrolled the Italian Renaissance.', metric: 'earningsCents', threshold: 100000 },
  { id: 'fugger-fortune', name: 'The Fugger Fortune', category: 'creator', icon: 'coin', label: '€2.5k', hint: 'Earn 2,500 euros.', blurb: 'The Augsburg banking dynasty whose loans financed emperors and popes alike.', metric: 'earningsCents', threshold: 250000 },
  { id: 'mansa-musa', name: 'Mansa Musa', category: 'creator', icon: 'coin', label: '€5k', hint: 'Earn 5,000 euros.', blurb: 'Emperor of Mali whose gold-laden pilgrimage made him perhaps history’s richest individual.', metric: 'earningsCents', threshold: 500000 },
  { id: 'crassus', name: 'Marcus Crassus', category: 'creator', icon: 'coin', label: '€7.5k', hint: 'Earn 7,500 euros.', blurb: 'Roman general reputed to be the wealthiest man of the late Republic.', metric: 'earningsCents', threshold: 750000 },
  { id: 'solomon', name: 'King Solomon', category: 'creator', icon: 'coin', label: '€10k', hint: 'Earn 10,000 euros.', blurb: 'Biblical king of Israel renowned for legendary wisdom and fabulous riches.', metric: 'earningsCents', threshold: 1000000 },

  // ── Creator: average rating (laurel, gated on review count) ──────────────
  { id: 'praxiteles', name: 'Praxiteles', category: 'creator', icon: 'laurel', label: '4.0★', hint: 'Reach a 4.0 average rating.', blurb: 'Athenian sculptor of the 4th century BC famed for graceful, lifelike marble figures.', min: { metric: 'ratingCount', value: 3 }, metric: 'avgRating', threshold: 4.0 },
  { id: 'michelangelo', name: 'Michelangelo', category: 'creator', icon: 'laurel', label: '4.5★', hint: 'Reach a 4.5 average rating.', blurb: 'Italian master whose David and Sistine Chapel ceiling crown the High Renaissance.', min: { metric: 'ratingCount', value: 5 }, metric: 'avgRating', threshold: 4.5 },
  { id: 'leonardo', name: 'Leonardo da Vinci', category: 'creator', icon: 'laurel', label: '5.0★', hint: 'Reach a perfect 5.0 average rating.', blurb: 'Italian polymath whose Mona Lisa and notebooks epitomise Renaissance genius.', min: { metric: 'ratingCount', value: 5 }, metric: 'avgRating', threshold: 5.0 },

  // ── Creator: tour craft / stops (route) ──────────────────────────────────
  { id: 'daedalus', name: 'Daedalus', category: 'creator', icon: 'route', label: '5', hint: 'Build a tour with 5 stops.', blurb: 'Mythic Greek craftsman who designed the Cretan labyrinth that held the Minotaur.', metric: 'maxStops', threshold: 5 },
  { id: 'vitruvius', name: 'Vitruvius', category: 'creator', icon: 'route', label: '10', hint: 'Build a tour with 10 stops.', blurb: 'Roman architect whose treatise on building shaped Western architectural theory.', metric: 'maxStops', threshold: 10 },
  { id: 'brunelleschi', name: 'Filippo Brunelleschi', category: 'creator', icon: 'route', label: '15', hint: 'Build a tour with 15 stops.', blurb: 'Florentine architect who engineered the great dome of Santa Maria del Fiore.', metric: 'maxStops', threshold: 15 },
  { id: 'wren', name: 'Christopher Wren', category: 'creator', icon: 'route', label: '20', hint: 'Build a tour with 20 stops.', blurb: 'English architect who rebuilt London’s churches and St Paul’s Cathedral after the Great Fire.', metric: 'maxStops', threshold: 20 },
  { id: 'haussmann', name: 'Baron Haussmann', category: 'creator', icon: 'route', label: '30', hint: 'Build a tour with 30 stops.', blurb: 'French official whose sweeping boulevards transformed the layout of 19th-century Paris.', metric: 'maxStops', threshold: 30 },
  { id: 'mercator', name: 'Gerardus Mercator', category: 'creator', icon: 'route', label: '40', hint: 'Build a tour with 40 stops.', blurb: 'Flemish cartographer whose map projection still guides navigation today.', metric: 'maxStops', threshold: 40 },

  // ── Creator: audience reach / countries (globe) ──────────────────────────
  { id: 'caesar', name: 'Julius Caesar', category: 'creator', icon: 'globe', label: '3', hint: 'Reach listeners in 3 countries.', blurb: 'Roman general and statesman whose conquests and assassination ended the Republic.', metric: 'audienceCountries', threshold: 3 },
  { id: 'alexander', name: 'Alexander the Great', category: 'creator', icon: 'globe', label: '5', hint: 'Reach listeners in 5 countries.', blurb: 'Macedonian king who forged an empire stretching from Greece to India by age thirty.', metric: 'audienceCountries', threshold: 5 },
  { id: 'genghis', name: 'Genghis Khan', category: 'creator', icon: 'globe', label: '10', hint: 'Reach listeners in 10 countries.', blurb: 'Mongol conqueror who founded the largest contiguous land empire in history.', metric: 'audienceCountries', threshold: 10 },
  { id: 'trajan', name: 'Trajan', category: 'creator', icon: 'globe', label: '25', hint: 'Reach listeners in 25 countries.', blurb: 'Roman emperor under whom the empire reached its greatest territorial extent.', metric: 'audienceCountries', threshold: 25 },
  { id: 'victoria', name: 'Queen Victoria', category: 'creator', icon: 'globe', label: '50', hint: 'Reach listeners in 50 countries.', blurb: 'British monarch whose long reign presided over a globe-spanning empire.', metric: 'audienceCountries', threshold: 50 },
  { id: 'augustus', name: 'Caesar Augustus', category: 'creator', icon: 'globe', label: '75', hint: 'Reach listeners in 75 countries.', blurb: 'First Roman emperor who inaugurated two centuries of imperial peace and order.', metric: 'audienceCountries', threshold: 75 },
  { id: 'cleopatra', name: 'Cleopatra', category: 'creator', icon: 'globe', label: '100', hint: 'Reach listeners in 100 countries.', blurb: 'Last active ruler of Ptolemaic Egypt, famed for her alliances with Caesar and Antony.', metric: 'audienceCountries', threshold: 100 },

  // ── Translator: languages offered (speech) ───────────────────────────────
  { id: 'saint-jerome', name: 'Saint Jerome', category: 'translator', icon: 'speech', label: '1', hint: 'Offer a tour in a second language.', blurb: 'Church father who translated the Bible into Latin, producing the enduring Vulgate.', metric: 'languagesOffered', threshold: 1 },
  { id: 'tyndale', name: 'William Tyndale', category: 'translator', icon: 'speech', label: '2', hint: 'Offer tours in 2 extra languages.', blurb: 'English reformer who first translated the Bible from the original tongues into English.', metric: 'languagesOffered', threshold: 2 },
  { id: 'xuanzang', name: 'Xuanzang', category: 'translator', icon: 'speech', label: '3', hint: 'Offer tours in 3 extra languages.', blurb: 'Tang-era monk who journeyed to India and translated Buddhist scriptures into Chinese.', metric: 'languagesOffered', threshold: 3 },
  { id: 'richard-burton', name: 'Richard Francis Burton', category: 'translator', icon: 'speech', label: '5', hint: 'Offer tours in 5 extra languages.', blurb: 'Victorian explorer and polyglot who translated the Arabian Nights and the Kama Sutra.', metric: 'languagesOffered', threshold: 5 },
  { id: 'mezzofanti', name: 'Cardinal Mezzofanti', category: 'translator', icon: 'speech', label: '7', hint: 'Offer tours in 7 extra languages.', blurb: 'Italian cardinal reputed to read and speak dozens of languages fluently.', metric: 'languagesOffered', threshold: 7 },

  // ── Translator: translation jobs (book) ──────────────────────────────────
  { id: 'septuagint', name: 'The Seventy', category: 'translator', icon: 'book', label: '10', hint: 'Complete 10 translation jobs.', blurb: 'The scholars said to have rendered the Hebrew scriptures into Greek as the Septuagint.', metric: 'translationJobs', threshold: 10 },
  { id: 'constance-garnett', name: 'Constance Garnett', category: 'translator', icon: 'book', label: '25', hint: 'Complete 25 translation jobs.', blurb: 'English translator who introduced the great Russian novelists to the anglophone world.', metric: 'translationJobs', threshold: 25 },
  { id: 'kumarajiva', name: 'Kumārajīva', category: 'translator', icon: 'book', label: '50', hint: 'Complete 50 translation jobs.', blurb: 'Buddhist monk whose lucid translations carried Indian sutras into Chinese culture.', metric: 'translationJobs', threshold: 50 },
  { id: 'gregory-martin', name: 'Gregory Martin', category: 'translator', icon: 'book', label: '75', hint: 'Complete 75 translation jobs.', blurb: 'English scholar who led the Douay-Rheims translation of the Bible into English.', metric: 'translationJobs', threshold: 75 },
  { id: 'bayt-al-hikma', name: 'Bayt al-Hikma', category: 'translator', icon: 'book', label: '100', hint: 'Complete 100 translation jobs.', blurb: 'The Baghdad House of Wisdom whose scholars translated Greek learning into Arabic.', metric: 'translationJobs', threshold: 100 },
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

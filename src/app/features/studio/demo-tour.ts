// ─────────────────────────────────────────────────────────────────────────────
// Demo "blueprint" tour — a deliberately silly, entirely fictional example that
// every creator can inspect in the Studio before building their own. Text +
// image placeholders only (no audio). Static data: it lives in every account
// and can never be edited or accidentally deleted.
//
// The e2e suite mirrors this shape when it spins up a throwaway dummy tour.
// ─────────────────────────────────────────────────────────────────────────────

export interface DemoStop {
  numeral: string;
  title: string;
  text: string;
  /** Cover-gradient class used as a fallback image placeholder. */
  gradient: string;
  /** Real photo (assigned from the assets below). */
  image?: string;
}

export interface DemoVenue {
  name: string;
  tagline: string;
  stops: DemoStop[];
}

export interface DemoTour {
  title: string;
  subtitle: string;
  description: string;
  meta: { stops: number; venues: number; duration: string; setting: string; price: string };
  venues: DemoVenue[];
}

export const DEMO_TOUR: DemoTour = {
  title: 'Atlantooga: The Sunken City That Never Was',
  subtitle: 'A blueprint tour · entirely fictional · suspiciously damp',
  description:
    'Welcome to the official demo tour. Atlantooga does not exist — which is exactly why ' +
    'it is the perfect place to see how a finished Constantine tour is put together. ' +
    'Wander its (made-up) venues, read the (nonsense) stop descriptions, and use this as ' +
    'a blueprint for your own, real, far-less-soggy tour.',
  meta: { stops: 12, venues: 5, duration: '≈ 90 min', setting: 'Mixed (mostly underwater)', price: 'Free' },
  venues: [
    {
      name: 'The Bubbling Forum',
      tagline: 'Where the city argued about whose turn it was to hold the air.',
      stops: [
        {
          numeral: 'I',
          title: 'The Whispering Clam',
          text: 'A mollusc so wise the council asked its advice on everything. It only ever said "hmm", ' +
            'which historians agree was usually the correct answer.',
          gradient: 'cover-grad--g1',
        },
        {
          numeral: 'II',
          title: 'Fountain of Questionable Youth',
          text: 'Drink from it and you feel 10 years younger and 40 years more confused. The plaque ' +
            'reads: "Results not guaranteed, refunds even less so."',
          gradient: 'cover-grad--g2',
        },
        {
          numeral: 'III',
          title: 'Statue of the Founder, Greg',
          text: 'Atlantooga was founded by Greg, a man who took a wrong turn looking for a beach and ' +
            'simply kept walking. He is depicted mid-shrug, as he was in life.',
          gradient: 'cover-grad--g3',
        },
      ],
    },
    {
      name: 'The Coral Colosseum',
      tagline: 'Home of the world-famous Annual Crab Olympics.',
      stops: [
        {
          numeral: 'IV',
          title: 'Gate of Forty Crabs',
          text: 'Guarded, traditionally, by forty crabs. Today only six remain on duty; the rest formed ' +
            'a union and now work flexible hours.',
          gradient: 'cover-grad--g4',
        },
        {
          numeral: 'V',
          title: 'The Echoing Amphitheatre',
          text: 'Shout your name here and it echoes back the name of someone slightly more successful. ' +
            'Acoustics described by one visitor as "rude but accurate".',
          gradient: 'cover-grad--g5',
        },
      ],
    },
    {
      name: "Poseidon's All-You-Can-Eat Kelp Bazaar",
      tagline: 'Five thousand years of street food. No survivors have complained.',
      stops: [
        {
          numeral: 'VI',
          title: 'The Pickled-Eel Stall',
          text: 'Run by the same family for nine generations, none of whom have ever tasted the product. ' +
            '"We sell it, we don\'t eat it," reads the proud family motto.',
          gradient: 'cover-grad--g6',
        },
        {
          numeral: 'VII',
          title: 'Shrine of the Lost Sock',
          text: 'Every sock that vanished in the wash, anywhere on Earth, eventually washes up here. ' +
            'Pilgrims come to maybe, finally, find the other one.',
          gradient: 'cover-grad--g7',
        },
        {
          numeral: 'VIII',
          title: 'The Bottomless Soup Cauldron',
          text: 'Simmering continuously since the city sank. Nobody knows the recipe and nobody is brave ' +
            'enough to ask what keeps falling in.',
          gradient: 'cover-grad--g8',
        },
      ],
    },
    {
      name: 'The Pearl Library',
      tagline: 'Quietest place in Atlantooga, on account of the drowning.',
      stops: [
        {
          numeral: 'IX',
          title: 'Hall of Unread Scrolls',
          text: 'Thousands of scrolls nobody has ever finished. The most borrowed title is "How to Hold ' +
            'Your Breath", returned, every time, mysteriously unread.',
          gradient: 'cover-grad--g9',
        },
        {
          numeral: 'X',
          title: 'The Squid-Ink Print Room',
          text: 'Where the city printed its one and only newspaper, "The Daily Bubble". Headlines were ' +
            'always smudged, which locals preferred — it left room for hope.',
          gradient: 'cover-grad--g10',
        },
      ],
    },
    {
      name: 'Mount Notreal',
      tagline: 'A mountain. Underwater. Look, nobody planned this city very carefully.',
      stops: [
        {
          numeral: 'XI',
          title: 'The Summit Gift Shop',
          text: 'Sells fridge magnets of a city with no fridges and snow globes of a city already entirely ' +
            'underwater. Best-selling item: a small bottle labelled "More Water".',
          gradient: 'cover-grad--g2',
        },
        {
          numeral: 'XII',
          title: 'The Very Last Step',
          text: 'You made it. There is no view, because it is underwater and also fictional, but there is ' +
            'a bench. Sit. Reflect. Then go build a tour of a place that actually exists.',
          gradient: 'cover-grad--g5',
        },
      ],
    },
  ],
};

// Real photos to stand in for stop images (cycled across the 12 stops). Swap in
// your own uploads here when they land in the assets folder.
const DEMO_PHOTOS = [
  'assets/homepage/tourist.jpg',
  'assets/homepage/jean-baptiste-d-OGw8hPRgPpY-unsplash.jpg',
  'assets/homepage/olivia-pedler-YX0HXl2SwIo-unsplash.jpg',
  'assets/homepage/chris-czermak.jpg',
  'assets/homepage/priscilla-du-preez-7etIYqqw2jU-unsplash.jpg',
  'assets/homepage/andrei-mike-LLRENtzIo34-unsplash.jpg',
  'assets/homepage/kai-pilger-1_D59lYGpZA-unsplash.jpg',
];

let _photoIdx = 0;
for (const venue of DEMO_TOUR.venues) {
  for (const stop of venue.stops) {
    stop.image = DEMO_PHOTOS[_photoIdx % DEMO_PHOTOS.length];
    _photoIdx++;
  }
}

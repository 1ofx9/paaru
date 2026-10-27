export interface UniverseQuery {
  title: string;
  type: 'tv' | 'movie';
  relation: 'PREQUEL' | 'SEQUEL' | 'SPIN_OFF' | 'SIDE_STORY';
  year?: number;
  anchorTitle?: string;
}

export interface UniverseBrand {
  name: string;
  triggers: string[];
  queries: UniverseQuery[];
}

export const UNIVERSE_BRANDS: UniverseBrand[] = [
  {
    name: 'Game of Thrones Universe',
    triggers: [
      'game of thrones',
      'house of the dragon',
      'a knight of the seven kingdoms',
      'knight of the seven kingdoms',
      'seven kingdoms',
      'song of ice and fire',
      'westeros',
    ],
    queries: [
      { title: 'Game of Thrones', type: 'tv', relation: 'SEQUEL' },
      { title: 'House of the Dragon', type: 'tv', relation: 'PREQUEL', anchorTitle: 'Game of Thrones' },
      { title: 'A Knight of the Seven Kingdoms', type: 'tv', relation: 'PREQUEL', anchorTitle: 'Game of Thrones' },
    ],
  },
  {
    name: 'Breaking Bad Universe',
    triggers: ['breaking bad', 'better call saul', 'el camino'],
    queries: [
      { title: 'Breaking Bad', type: 'tv', relation: 'SEQUEL' },
      { title: 'Better Call Saul', type: 'tv', relation: 'PREQUEL', anchorTitle: 'Breaking Bad' },
      { title: 'El Camino: A Breaking Bad Movie', type: 'movie', relation: 'SEQUEL', anchorTitle: 'Breaking Bad' },
    ],
  },
  {
    name: 'The Walking Dead Universe',
    triggers: ['walking dead', 'daryl dixon', 'fear the walking dead', 'the ones who live', 'dead city'],
    queries: [
      { title: 'The Walking Dead', type: 'tv', relation: 'SEQUEL' },
      { title: 'Fear the Walking Dead', type: 'tv', relation: 'SPIN_OFF', anchorTitle: 'The Walking Dead' },
      { title: 'The Walking Dead: Dead City', type: 'tv', relation: 'SEQUEL', anchorTitle: 'The Walking Dead' },
      { title: 'The Walking Dead: Daryl Dixon', type: 'tv', relation: 'SEQUEL', anchorTitle: 'The Walking Dead' },
      { title: 'The Walking Dead: The Ones Who Live', type: 'tv', relation: 'SEQUEL', anchorTitle: 'The Walking Dead' },
    ],
  },
  {
    name: 'The Boys Universe',
    triggers: ['the boys', 'gen v', 'diabolical'],
    queries: [
      { title: 'The Boys', type: 'tv', relation: 'SEQUEL' },
      { title: 'Gen V', type: 'tv', relation: 'SPIN_OFF', anchorTitle: 'The Boys' },
    ],
  },
  {
    name: 'The Big Bang Theory Universe',
    triggers: ['big bang theory', 'young sheldon', 'georgie & mandy'],
    queries: [
      { title: 'The Big Bang Theory', type: 'tv', relation: 'SEQUEL' },
      { title: 'Young Sheldon', type: 'tv', relation: 'PREQUEL', anchorTitle: 'The Big Bang Theory' },
      { title: "Georgie & Mandy's First Marriage", type: 'tv', relation: 'SEQUEL', anchorTitle: 'Young Sheldon' },
    ],
  },
  {
    name: 'Yellowstone Universe',
    triggers: ['yellowstone', '1883', '1923'],
    queries: [
      { title: 'Yellowstone', type: 'tv', relation: 'SEQUEL' },
      { title: '1883', type: 'tv', relation: 'PREQUEL', anchorTitle: 'Yellowstone' },
      { title: '1923', type: 'tv', relation: 'PREQUEL', anchorTitle: 'Yellowstone' },
    ],
  },
  {
    name: 'The Batman Universe',
    triggers: ['the batman', 'the penguin'],
    queries: [
      { title: 'The Batman', type: 'movie', relation: 'SEQUEL' },
      { title: 'The Penguin', type: 'tv', relation: 'SEQUEL', anchorTitle: 'The Batman' },
    ],
  },
  {
    name: 'Dune Universe',
    triggers: ['dune', 'dune: part two', 'dune: prophecy'],
    queries: [
      { title: 'Dune', type: 'movie', relation: 'SEQUEL' },
      { title: 'Dune: Part Two', type: 'movie', relation: 'SEQUEL', anchorTitle: 'Dune' },
      { title: 'Dune: Prophecy', type: 'tv', relation: 'PREQUEL', anchorTitle: 'Dune' },
    ],
  },
  {
    name: 'Dexter Universe',
    triggers: ['dexter', 'dexter: new blood', 'dexter: original sin'],
    queries: [
      { title: 'Dexter', type: 'tv', relation: 'SEQUEL' },
      { title: 'Dexter: New Blood', type: 'tv', relation: 'SEQUEL', anchorTitle: 'Dexter' },
      { title: 'Dexter: Original Sin', type: 'tv', relation: 'PREQUEL', anchorTitle: 'Dexter' },
    ],
  },
  {
    name: 'The Lord of the Rings Universe',
    triggers: ['lord of the rings', 'the hobbit', 'rings of power'],
    queries: [
      { title: 'The Lord of the Rings: The Fellowship of the Ring', type: 'movie', relation: 'SEQUEL' },
      { title: 'The Lord of the Rings: The Two Towers', type: 'movie', relation: 'SEQUEL', anchorTitle: 'The Lord of the Rings: The Fellowship of the Ring' },
      { title: 'The Lord of the Rings: The Return of the King', type: 'movie', relation: 'SEQUEL', anchorTitle: 'The Lord of the Rings: The Two Towers' },
      { title: 'The Hobbit: An Unexpected Journey', type: 'movie', relation: 'PREQUEL', anchorTitle: 'The Lord of the Rings: The Fellowship of the Ring' },
      { title: 'The Hobbit: The Desolation of Smaug', type: 'movie', relation: 'SEQUEL', anchorTitle: 'The Hobbit: An Unexpected Journey' },
      { title: 'The Hobbit: The Battle of the Five Armies', type: 'movie', relation: 'SEQUEL', anchorTitle: 'The Hobbit: The Desolation of Smaug' },
      { title: 'The Lord of the Rings: The Rings of Power', type: 'tv', relation: 'PREQUEL', anchorTitle: 'The Hobbit: An Unexpected Journey' },
    ],
  },
  {
    name: 'Suits Universe',
    triggers: ['suits', 'pearson', 'suits: la'],
    queries: [
      { title: 'Suits', type: 'tv', relation: 'SEQUEL' },
      { title: 'Pearson', type: 'tv', relation: 'SPIN_OFF', anchorTitle: 'Suits' },
    ],
  },
  {
    name: 'Vikings Universe',
    triggers: ['vikings', 'vikings: valhalla'],
    queries: [
      { title: 'Vikings', type: 'tv', relation: 'SEQUEL' },
      { title: 'Vikings: Valhalla', type: 'tv', relation: 'SEQUEL', anchorTitle: 'Vikings' },
    ],
  },
  {
    name: 'Avatar: The Last Airbender Universe',
    triggers: ['avatar: the last airbender', 'the legend of korra'],
    queries: [
      { title: 'Avatar: The Last Airbender', type: 'tv', relation: 'SEQUEL' },
      { title: 'The Legend of Korra', type: 'tv', relation: 'SEQUEL', anchorTitle: 'Avatar: The Last Airbender' },
    ],
  },
];

export function findUniverseForTitle(title: string): UniverseBrand | null {
  const norm = title.toLowerCase().trim();
  for (const brand of UNIVERSE_BRANDS) {
    if (brand.triggers.some((trigger) => norm.includes(trigger) || trigger.includes(norm))) {
      return brand;
    }
  }
  return null;
}

export function matchesExpectedTitle(actualTitle?: string | null, expectedTitle?: string | null): boolean {
  if (!actualTitle || !expectedTitle) return false;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/[^a-z0-9]/g, '');

  const nActual = norm(actualTitle);
  const nExpected = norm(expectedTitle);
  if (!nActual || !nExpected) return false;
  return nActual.includes(nExpected) || nExpected.includes(nActual);
}

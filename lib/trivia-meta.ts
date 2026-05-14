// Pure metadata + distribution helpers. No server-only deps — safe to import
// from client components, API routes, and lib/questions.ts alike.

export type TriviaKind = 'text' | 'image' | 'ranking';
export type Difficulty = 'easy' | 'medium' | 'hard';

export const SUB_ANGLES: Record<string, string[]> = {
  'General': ['everyday science', 'language and words', 'world records', 'inventions', 'famous firsts', 'curiosities'],
  'History': ['ancient civilizations', 'medieval world', 'modern era (1800-1950)', 'contemporary (1950+)', 'social and cultural', 'non-Western history'],
  'Geography': ['physical features', 'countries and capitals', 'cities and landmarks', 'rivers and oceans', 'borders and territories', 'cultural geography'],
  'Science': ['physics', 'chemistry', 'biology', 'earth science', 'scientists and discoveries', 'everyday science'],
  'Cinema': ['classic film (pre-1980)', 'modern blockbusters', 'directors and auteurs', 'actors and performances', 'world cinema', 'film history and trivia'],
  'TV & Series': ['sitcoms', 'drama series', 'reality TV', 'animated shows', 'international TV', 'TV history'],
  'Music': ['classical and opera', 'rock and pop', 'hip-hop and R&B', 'jazz and blues', 'world music', 'music history and theory'],
  'Sports': ['football/soccer', 'olympic sports', 'american sports', 'tennis and golf', 'extreme and niche sports', 'sports history'],
  'Literature': ['classic novels', 'poetry', 'modern fiction', 'non-fiction', 'world literature', 'authors and lives'],
  'Food & Drink': ['world cuisines', 'ingredients and techniques', 'drinks and cocktails', 'food history', 'famous chefs', 'food science'],
  'Pop Culture': ['celebrity moments', 'internet phenomena', 'fashion and trends', 'cultural icons', 'scandals and news', 'memorable moments'],
  'Tech & Internet': ['companies and founders', 'history of computing', 'internet culture', 'gadgets and products', 'concepts and how-it-works', 'famous failures'],
  'Art': ['painting', 'sculpture', 'modern and contemporary', 'art movements', 'artists and lives', 'museums and works'],
  'Mythology': ['greek and roman', 'norse', 'egyptian', 'asian mythologies', 'world folklore', 'mythological creatures'],
  'Video Games': ['classic arcade and consoles', 'modern AAA games', 'indie games', 'game developers and studios', 'gaming culture', 'esports'],
  'Nature & Animals': ['mammals', 'birds and reptiles', 'marine life', 'insects and invertebrates', 'ecosystems and habitats', 'extinct and prehistoric'],
  'Space': ['solar system', 'stars and galaxies', 'space exploration', 'astronauts and missions', 'telescopes and discoveries', 'cosmology'],
  'Politics': ['world leaders', 'political systems', 'elections and movements', 'international relations', 'political history', 'political concepts'],
};

function shuffle<T>(arr: T[]): T[] {
  return arr
    .map(v => ({ v, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map(o => o.v);
}

export function pickSubAngle(category: string): string {
  const angles = SUB_ANGLES[category];
  if (!angles || angles.length === 0) return '';
  return angles[Math.floor(Math.random() * angles.length)];
}

// 30% easy / 50% medium / 20% hard across n rounds, returned shuffled.
export function assignDifficulties(n: number): Difficulty[] {
  if (n <= 0) return [];
  const easy = Math.round(n * 0.3);
  const hard = Math.round(n * 0.2);
  const medium = Math.max(0, n - easy - hard);
  return shuffle<Difficulty>([
    ...Array(easy).fill('easy'),
    ...Array(medium).fill('medium'),
    ...Array(hard).fill('hard'),
  ]);
}

// 15% image / 25% ranking / 60% text across n trivia rounds, returned shuffled.
export function assignKinds(n: number): TriviaKind[] {
  if (n <= 0) return [];
  const image = Math.round(n * 0.15);
  const ranking = Math.round(n * 0.25);
  const text = Math.max(0, n - image - ranking);
  return shuffle<TriviaKind>([
    ...Array(image).fill('image'),
    ...Array(ranking).fill('ranking'),
    ...Array(text).fill('text'),
  ]);
}

type TriviaMeta = { triviaKind?: TriviaKind; subAngle?: string; difficulty?: Difficulty };

// Pre-assigns kind / sub-angle / difficulty to every trivia entry in a queue.
// Non-trivia entries pass through untouched. Returns a new array (entries copied).
export function assignTriviaMeta<T extends { game: string; category: string } & TriviaMeta>(
  entries: T[],
): T[] {
  const result = entries.map(e => ({ ...e }));
  const triviaIdx: number[] = [];
  result.forEach((e, i) => { if (e.game === 'trivia') triviaIdx.push(i); });
  const n = triviaIdx.length;
  if (n === 0) return result;

  const kinds = assignKinds(n);
  const diffs = assignDifficulties(n);
  triviaIdx.forEach((entryIdx, k) => {
    result[entryIdx].triviaKind = kinds[k];
    result[entryIdx].difficulty = diffs[k];
    result[entryIdx].subAngle = pickSubAngle(result[entryIdx].category);
  });
  return result;
}

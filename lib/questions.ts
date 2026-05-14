import Anthropic from '@anthropic-ai/sdk';
import { fetchWikiImage } from '@/lib/wiki';
import type { TriviaKind, Difficulty } from '@/lib/trivia-meta';

export type { TriviaKind, Difficulty };

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type QuestionOpts = {
  // General subject exclusion list — every question type contributes (cross-session).
  avoidSubjects?: string[];
  // Image-only subject exclusion list (narrower pool, tracked separately).
  avoidImageSubjects?: string[];
  triviaKind?: TriviaKind;
  subAngle?: string;
  difficulty?: Difficulty;
};

const DIFFICULTY_DEF: Record<Difficulty, string> = {
  easy: 'EASY — a well-informed adult would get this right most of the time. Common knowledge with a slight twist.',
  medium: 'MEDIUM — a curious generalist or trivia enthusiast would get this. Requires some specific knowledge but not specialist-level.',
  hard: 'HARD — a specialist or very well-read person would get this. Requires deeper knowledge but NEVER PhD-level or obscure-fact knowledge. Challenging but fair, not "impossible without Wikipedia open".',
};

const TONE = `TONE: Aim for trivia that a curious generalist would find satisfying. Think bar-trivia-with-character, not pub-quiz-tedium. Avoid two failure modes:
- Too obvious: "What is the capital of France?", "Who painted the Mona Lisa?", "What color is the sky?". These bore players.
- Too obscure: "In what year did the Treaty of Nystad transfer Estonia to Russia?", "What is the IUPAC name for caffeine?". These frustrate players.
Questions should make a player think "huh, I should know that" or "oh that's interesting" — never "no one would know that" or "too easy to ask."`;

function avoidSubjectsClause(avoidSubjects?: string[]) {
  if (!avoidSubjects || !avoidSubjects.length) return '';
  return `\n\nEXCLUSION LIST — do not generate a question whose subject matter overlaps with anything here. Pick a genuinely different subject within the chosen sub-angle:\n${avoidSubjects.join('; ')}`;
}

function avoidImageSubjectsClause(avoidImageSubjects?: string[]) {
  if (!avoidImageSubjects || !avoidImageSubjects.length) return '';
  return `\n\nIMAGE EXCLUSION LIST — do not pick a wikiQuery that overlaps with anything here. Image questions have a narrower subject pool, so make a deliberate effort to pick a fresh subject:\n${avoidImageSubjects.join('; ')}`;
}

function triviaHeader(category: string, subAngle: string, difficulty: Difficulty) {
  const angleLine = subAngle
    ? `\nSUB-ANGLE: focus on "${subAngle}". The question should clearly be about this aspect of ${category}.`
    : '';
  return `You are generating a trivia question for a parlor game.

${TONE}

CATEGORY: ${category}${angleLine}

DIFFICULTY: ${DIFFICULTY_DEF[difficulty]}

Be culturally diverse — not US-centric.`;
}

export function buildTriviaTextPrompt(category: string, opts: QuestionOpts = {}) {
  const subAngle = opts.subAngle ?? '';
  const difficulty = opts.difficulty ?? 'medium';
  return `${triviaHeader(category, subAngle, difficulty)}

QUESTION TYPE: text-only multiple-choice. Set "imageFirst": false and "wikiQuery": null.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "imageFirst": false,
  "subject": "2-5 word subject stem, e.g. 'battle of Hastings' or 'atomic number of gold'",
  "question": "string",
  "choices": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "1-2 sentence fun fact",
  "wikiQuery": null
}${avoidSubjectsClause(opts.avoidSubjects)}`;
}

export function buildTriviaImagePrompt(category: string, opts: QuestionOpts = {}) {
  const subAngle = opts.subAngle ?? '';
  const difficulty = opts.difficulty ?? 'medium';
  return `${triviaHeader(category, subAngle, difficulty)}

QUESTION TYPE: image-first. An image of the subject will be shown to players; the question text MUST NOT name, describe, hint at, or paraphrase the subject.

IMAGE-FRIENDLY SUBJECT: ${subAngle ? `within the sub-angle "${subAngle}", pick` : 'Pick'} a wikiQuery that is image-friendly. Image-friendly subjects include: people (historical figures, artists, scientists, athletes, performers), places (cities, landmarks, natural features, monuments), objects (artifacts, paintings, sculptures, inventions, vehicles), animals and plants, flags and maps.

QUESTION-TYPE VARIETY — randomly pick ONE style for this image (do NOT always use identification):
1. IDENTIFICATION (~40%): "Who is this?" / "What is this?" / "Where is this?"
2. CONTEXT/YEAR (~20%): "In what decade was this built?" / "What year did this person win the Nobel Prize?"
3. ATTRIBUTION (~20%): "Who painted this?" / "Who directed this film?" / "Who designed this?"
4. LOCATION (~10%): "In what country is this located?" / "On what continent?"
5. RELATED FACT (~10%): "What is this animal's primary diet?" / "What language is spoken here?"
The image carries the visual ID; the question asks something the player can deduce or know once they recognize the subject. The question text still MUST NOT name the subject.

Set "wikiQuery" to the EXACT Wikipedia article title (or a Commons-friendly subject name) of what's pictured. The four choices are the candidate answers.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "imageFirst": true,
  "subject": "2-5 word subject stem",
  "question": "the question (must NOT name the subject)",
  "choices": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "1-2 sentence fun fact",
  "wikiQuery": "exact Wikipedia article title"
}${avoidSubjectsClause(opts.avoidSubjects)}${avoidImageSubjectsClause(opts.avoidImageSubjects)}`;
}

export function buildTriviaRankingPrompt(category: string, opts: QuestionOpts = {}) {
  const subAngle = opts.subAngle ?? '';
  const difficulty = opts.difficulty ?? 'medium';
  return `${triviaHeader(category, subAngle, difficulty)}

QUESTION TYPE: ranking. Give 4 items the player must place in correct order.

Rules:
- Pick exactly 4 items from a SINGLE comparable category (all films, all countries, all mountains, all athletes, all events — never mix kinds).
- Pick a clear, OBJECTIVE ranking criterion: release year, population, height, distance, championship count, founding date, area, etc. Never subjective ("best", "most popular").
- Phrase the question clearly, e.g. "Rank these countries by population, largest to smallest."
- The "items" array MUST be in the CORRECT ORDER according to the criterion (the server shuffles them before showing the player).
- The correct order must be verifiable and unambiguous.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "kind": "ranking",
  "subject": "2-5 word subject stem",
  "question": "Rank these films from oldest to newest",
  "items": ["item in correct rank 1", "item in correct rank 2", "item in correct rank 3", "item in correct rank 4"],
  "explanation": "1-2 sentence context, e.g. the actual years"
}${avoidSubjectsClause(opts.avoidSubjects)}`;
}

export function buildPrompt(game: string, category: string, opts: QuestionOpts = {}) {
  if (game === 'trivia') {
    const kind = opts.triviaKind ?? 'text';
    if (kind === 'image') return buildTriviaImagePrompt(category, opts);
    if (kind === 'ranking') return buildTriviaRankingPrompt(category, opts);
    return buildTriviaTextPrompt(category, opts);
  }

  const avoid = avoidSubjectsClause(opts.avoidSubjects);

  if (game === 'wall') {
    return `Create ONE "wall" challenge for the broad category "${category}".
INVENT a fresh, specific, verifiable criterion — don't reuse the same kind of criterion twice.
Examples for "Geography": "Capitals of South American countries" / "Countries bordering France" / "Rivers longer than 4000 km"
Examples for "Cinema": "Films directed by Christopher Nolan" / "Best Picture winners of the 2010s" / "Pixar films released before 2010"

Rules:
- Exactly 12 items total: 8 that match the criterion, 4 that don't
- The 4 wrong ones must be GOOD distractors — plausible near-misses, not random nonsense
- Everything must be factually verifiable

Respond ONLY with valid JSON, no markdown:
{
  "question": "Pick the 8 [items] that [criterion]. Avoid the 4 that don't.",
  "criterion": "short restatement of what makes an item correct",
  "items": [{"label": "string", "correct": true}],
  "explanation": "why the 4 wrong ones don't qualify"
}${avoid}`;
  }

  return `Create ONE "closest guess" question from the broad category "${category}".
- The answer must be a precise, verifiable number
- Vary the type: years, distances, populations, percentages, prices, durations, weights, counts

Respond ONLY with valid JSON, no markdown:
{
  "question": "string",
  "answer": 1234.5,
  "unit": "km / year / % / people / etc.",
  "explanation": "1-2 sentence context about the answer"
}${avoid}`;
}

export async function callClaude(prompt: string): Promise<any> {
  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = msg.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('\n')
    .replace(/```json|```/g, '')
    .trim();
  return JSON.parse(text);
}

// Server-side shuffle for ranking items. Claude returns items in correct order;
// we shuffle and emit a correctOrder array that maps rank → shuffled index.
function shuffleRanking(data: any) {
  if (!Array.isArray(data?.items) || data.items.length !== 4) return data;
  const indexed = (data.items as string[]).map((label, originalIdx) => ({ label, originalIdx }));
  const shuffled = indexed
    .map(o => ({ o, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .map(x => x.o);
  const newItems = shuffled.map(x => x.label);
  const correctOrder = indexed.map(({ originalIdx }) =>
    shuffled.findIndex(x => x.originalIdx === originalIdx),
  );
  return { ...data, items: newItems, correctOrder, kind: 'ranking' };
}

// Fisher-Yates shuffle of the 4 multiple-choice options, with correctIndex
// remapped to the answer's new position. Counters Claude's positional bias
// (it tends to place the correct answer at index 0).
function shuffleChoices(data: any) {
  if (!Array.isArray(data?.choices) || data.choices.length !== 4) return data;
  if (typeof data.correctIndex !== 'number') return data;
  const correctAnswer = data.choices[data.correctIndex];
  const shuffled = [...data.choices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { ...data, choices: shuffled, correctIndex: shuffled.indexOf(correctAnswer) };
}

export async function generateQuestion(
  game: 'trivia' | 'wall' | 'closest',
  category: string,
  opts: QuestionOpts = {},
): Promise<any> {
  let data = await callClaude(buildPrompt(game, category, opts));

  if (game === 'wall' && Array.isArray(data.items)) {
    data.items = data.items
      .map((v: any) => ({ v, k: Math.random() }))
      .sort((a: any, b: any) => a.k - b.k)
      .map((o: any) => o.v);
  }

  if (game === 'trivia' && opts.triviaKind === 'ranking') {
    return shuffleRanking(data);
  }

  if (game === 'trivia' && opts.triviaKind === 'image' && data.imageFirst && data.wikiQuery) {
    const imageUrl = await fetchWikiImage(data.wikiQuery);
    if (imageUrl) {
      data.imageUrl = imageUrl;
    } else {
      // Both Wikipedia and Commons failed — fall back to a fresh text-only question.
      try {
        data = await callClaude(buildTriviaTextPrompt(category, { ...opts, triviaKind: 'text' }));
      } catch {
        // keep the original payload but without an image
      }
    }
  }

  // Randomize answer position for all trivia multiple-choice questions.
  if (game === 'trivia') {
    data = shuffleChoices(data);
  }

  return data;
}

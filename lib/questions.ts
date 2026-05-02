import Anthropic from '@anthropic-ai/sdk';
import { fetchWikiImage } from '@/lib/wiki';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type TriviaKind = 'text' | 'image' | 'ranking';

function buildAvoidQuestionsClause(previousQuestions: string[]) {
  return previousQuestions.length
    ? `\n\nDo not repeat any of these already-asked questions from this session: ${previousQuestions.slice(-15).join('; ')}`
    : '';
}

function buildAvoidWikiClause(avoidWikiSubjects: string[]) {
  return avoidWikiSubjects.length
    ? `\n\nDo not pick a subject already used in this session: ${avoidWikiSubjects.slice(-30).join('; ')}.`
    : '';
}

export function buildTriviaTextPrompt(category: string, previousQuestions: string[]) {
  return `Generate ONE text-only trivia question from the broad category "${category}".
- Vary the difficulty randomly (easy / medium / hard)
- Be culturally diverse — not US-centric
- This must be a text-only question: set "imageFirst": false and "wikiQuery": null.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "imageFirst": false,
  "question": "string",
  "choices": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "1-2 sentence fun fact",
  "wikiQuery": null
}${buildAvoidQuestionsClause(previousQuestions)}`;
}

export function buildTriviaImagePrompt(
  category: string,
  previousQuestions: string[],
  avoidWikiSubjects: string[],
) {
  return `Generate ONE image-first trivia question from the broad category "${category}".
- Vary the difficulty randomly (easy / medium / hard)
- Be culturally diverse — not US-centric
- The image carries all the information; the question text MUST NOT name, describe, hint at, or paraphrase the subject.
- The question text should be one of: "Who is this?", "Where is this?", "What is this?", "Which [country/painting/animal/dish] is this?", "Whose work is this?", "What is this landmark called?", "In which country is this located?"
- Pick any subject likely to have a Wikipedia article OR a Wikimedia Commons image — people, places, landmarks, animals, artworks, objects, historical events, dishes, plants, vehicles, flags, logos, etc. Choose freely; well-known subjects are fine.
- Set "wikiQuery" to the EXACT Wikipedia article title (or a Commons-friendly subject name) of what's pictured.
- The four choices are the candidate answers.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "imageFirst": true,
  "question": "Who is this?",
  "choices": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "1-2 sentence fun fact",
  "wikiQuery": "exact Wikipedia article title"
}${buildAvoidQuestionsClause(previousQuestions)}${buildAvoidWikiClause(avoidWikiSubjects)}`;
}

export function buildTriviaRankingPrompt(
  category: string,
  previousQuestions: string[],
  avoidWikiSubjects: string[],
) {
  return `Generate ONE ranking trivia question from the broad category "${category}".
- Vary the difficulty randomly (easy / medium / hard)
- Be culturally diverse — not US-centric
- A ranking question gives 4 items that the player must place in correct order.

Rules:
- Pick exactly 4 items from a SINGLE comparable category (all films, all countries, all mountains, all athletes, all events, etc. — never mix kinds).
- Pick a clear, OBJECTIVE ranking criterion: release year, population, height, distance, championship count, founding date, area, etc. Never subjective ("best", "most popular").
- Phrase the question clearly, e.g. "Rank these countries by population, largest to smallest." or "Rank these films from oldest to newest."
- The "items" array MUST be in the CORRECT ORDER according to the criterion (the server will shuffle them before showing the player).
- The correct order must be verifiable and unambiguous.
- Vary subjects across rounds — don't always pick films or countries.

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "kind": "ranking",
  "question": "Rank these films from oldest to newest",
  "items": ["item in correct rank 1", "item in correct rank 2", "item in correct rank 3", "item in correct rank 4"],
  "explanation": "1-2 sentence context, e.g. the actual years"
}${buildAvoidQuestionsClause(previousQuestions)}${buildAvoidWikiClause(avoidWikiSubjects)}`;
}

export function buildPrompt(
  game: string,
  category: string,
  previousQuestions: string[],
  avoidWikiSubjects: string[] = [],
  triviaKind: TriviaKind = 'text',
) {
  if (game === 'trivia') {
    if (triviaKind === 'image') return buildTriviaImagePrompt(category, previousQuestions, avoidWikiSubjects);
    if (triviaKind === 'ranking') return buildTriviaRankingPrompt(category, previousQuestions, avoidWikiSubjects);
    return buildTriviaTextPrompt(category, previousQuestions);
  }

  const avoid = buildAvoidQuestionsClause(previousQuestions);

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
  // correctOrder[rank] = position in newItems of the item that belongs at that rank
  const correctOrder = indexed.map(({ originalIdx }) =>
    shuffled.findIndex(x => x.originalIdx === originalIdx),
  );
  return { ...data, items: newItems, correctOrder, kind: 'ranking' };
}

export async function generateQuestion(
  game: 'trivia' | 'wall' | 'closest',
  category: string,
  previousQuestions: string[],
  avoidWikiSubjects: string[] = [],
  triviaKind: TriviaKind = 'text',
): Promise<any> {
  const data = await callClaude(
    buildPrompt(game, category, previousQuestions, avoidWikiSubjects, triviaKind),
  );

  if (game === 'wall' && Array.isArray(data.items)) {
    data.items = data.items
      .map((v: any) => ({ v, k: Math.random() }))
      .sort((a: any, b: any) => a.k - b.k)
      .map((o: any) => o.v);
  }

  if (game === 'trivia' && triviaKind === 'ranking') {
    return shuffleRanking(data);
  }

  if (game === 'trivia' && triviaKind === 'image' && data.imageFirst && data.wikiQuery) {
    const imageUrl = await fetchWikiImage(data.wikiQuery);
    if (imageUrl) {
      data.imageUrl = imageUrl;
    } else {
      // Both Wikipedia and Commons failed — fall back to a fresh text-only trivia question.
      try {
        return await callClaude(buildTriviaTextPrompt(category, previousQuestions));
      } catch {
        // keep the original payload but without an image
      }
    }
  }

  return data;
}

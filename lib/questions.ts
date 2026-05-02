import Anthropic from '@anthropic-ai/sdk';
import { fetchWikiImage } from '@/lib/wiki';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function buildAvoidQuestionsClause(previousQuestions: string[]) {
  return previousQuestions.length
    ? `\n\nDo not repeat any of these already-asked questions from this session: ${previousQuestions.slice(-15).join('; ')}`
    : '';
}

function buildAvoidWikiClause(avoidWikiSubjects: string[]) {
  return avoidWikiSubjects.length
    ? `\n\nDo not pick a wikiQuery for any subject already used in this session: ${avoidWikiSubjects.slice(-30).join('; ')}.`
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

export function buildPrompt(
  game: string,
  category: string,
  previousQuestions: string[],
  avoidWikiSubjects: string[] = [],
  isImageQuestion = false,
) {
  if (game === 'trivia') {
    return isImageQuestion
      ? buildTriviaImagePrompt(category, previousQuestions, avoidWikiSubjects)
      : buildTriviaTextPrompt(category, previousQuestions);
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

export async function generateQuestion(
  game: 'trivia' | 'wall' | 'closest',
  category: string,
  previousQuestions: string[],
  avoidWikiSubjects: string[] = [],
  isImageQuestion = false,
): Promise<any> {
  const data = await callClaude(
    buildPrompt(game, category, previousQuestions, avoidWikiSubjects, isImageQuestion),
  );

  if (game === 'wall' && Array.isArray(data.items)) {
    data.items = data.items
      .map((v: any) => ({ v, k: Math.random() }))
      .sort((a: any, b: any) => a.k - b.k)
      .map((o: any) => o.v);
  }

  if (game === 'trivia' && data.imageFirst && data.wikiQuery) {
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

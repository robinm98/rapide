import Anthropic from '@anthropic-ai/sdk';
import { fetchWikiImage } from '@/lib/wiki';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export function buildTriviaFallbackPrompt(category: string, previousQuestions: string[]) {
  const avoid = previousQuestions.length
    ? `\n\nStrictly AVOID repeating these already-asked topics: ${previousQuestions.slice(-15).join('; ')}`
    : '';
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
}${avoid}`;
}

export function buildPrompt(game: string, category: string, previousQuestions: string[]) {
  const avoid = previousQuestions.length
    ? `\n\nStrictly AVOID repeating these already-asked topics/criteria: ${previousQuestions.slice(-15).join('; ')}`
    : '';

  if (game === 'trivia') {
    return `Generate ONE trivia question from the broad category "${category}".
- Vary the difficulty randomly (easy / medium / hard)
- Be culturally diverse — not US-centric

IMAGE-FIRST RULE (use ~30% of the time):
When the answer is something visually iconic — a famous person, landmark, painting, flag, animal, dish, building, logo, album cover — generate an IMAGE-FIRST question where the image carries all the information.
For image-first questions:
  • Set "imageFirst": true
  • The question text MUST be one of these forms (or closely similar): "Who is this?", "Where is this?", "What is this?", "Which [country/painting/animal/dish] is this?", "Whose work is this?", "What is this landmark called?", "In which country is this located?"
  • The question text MUST NOT name, describe, hint at, or paraphrase the subject — the image carries that
  • Set "wikiQuery" to the EXACT Wikipedia article title of the subject shown (e.g. "Mona Lisa", "Mount Fuji", "Frida Kahlo", "Margherita pizza")
  • The four choices are the candidate answers
  • STRICTLY AVOID these overused subjects: Mona Lisa, Eiffel Tower, Big Ben, Statue of Liberty, Mount Everest, Mount Fuji, Taj Mahal, Pyramids of Giza, Colosseum, Great Wall of China, Sydney Opera House, Christ the Redeemer, Parthenon, Stonehenge, Machu Picchu. Prefer less-obvious but still visually recognizable subjects: lesser-known landmarks, regional dishes, animals from specific habitats, historical figures beyond the most famous tier, paintings beyond the top 10, flags of less-discussed countries.

TEXT-ONLY RULE (use ~70% of the time):
  • Set "imageFirst": false
  • Set "wikiQuery": null
  • Write a complete self-contained text question as normal

Respond ONLY with valid JSON, no markdown, no preamble:
{
  "imageFirst": true,
  "question": "Who is this?",
  "choices": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "1-2 sentence fun fact",
  "wikiQuery": "exact Wikipedia article title"
}
(or "imageFirst": false, "wikiQuery": null for text questions)${avoid}`;
  }

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
  previousQuestions: string[]
): Promise<any> {
  const data = await callClaude(buildPrompt(game, category, previousQuestions));

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
      try {
        return await callClaude(buildTriviaFallbackPrompt(category, previousQuestions));
      } catch {
        // play original without image
      }
    }
  }

  return data;
}

import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = 'nodejs';
export const maxDuration = 30;

function buildPrompt(game: string, category: string, previousQuestions: string[]) {
  const avoid = previousQuestions.length
    ? `\n\nAVOID these already-asked topics: ${previousQuestions.slice(-15).join('; ')}`
    : '';

  if (game === 'trivia') {
    return `Generate ONE medium-difficulty trivia question in the category "${category}".
Respond ONLY with valid JSON, no markdown, no preamble:
{
  "question": "the question text",
  "choices": ["A", "B", "C", "D"],
  "correctIndex": 0,
  "explanation": "1-2 sentence fun fact"
}
Make it interesting, not obvious. Mix in pop culture, history, science, geography, arts.${avoid}`;
  }
  if (game === 'wall') {
    return `Create ONE "wall" challenge. The user sees 12 items in a 3x4 grid. 8 match a criterion, 4 don't. Theme: "${category}".
Respond ONLY with valid JSON, no markdown:
{
  "question": "Pick the 8 items that [criterion]. Avoid the 4 that don't.",
  "criterion": "short restatement of what makes an item correct",
  "items": [
    {"label":"item 1","correct":true},
    {"label":"item 2","correct":false}
  ],
  "explanation": "1-2 sentence explanation of why the 4 wrong ones are wrong"
}
Exactly 12 items, exactly 8 true and 4 false. Examples: "Mountains above 8000m" with 8 real 8000ers + 4 that are 7500-7999m; "Movies directed by Christopher Nolan" with 8 real + 4 not by him. Be creative but factual.${avoid}`;
  }
  return `Create ONE "closest guess" question. Players answer with a number and the closest wins. Topic: "${category}".
Respond ONLY with valid JSON, no markdown:
{
  "question": "the question — must have a precise numeric answer",
  "answer": 1234.5,
  "unit": "km, year, %, people, etc.",
  "explanation": "1-2 sentence context about the answer"
}
Good examples: "In what year did the Titanic sink?" (1912), "How tall is Mount Everest in meters?" (8849). Make the answer verifiable and specific.${avoid}`;
}

export async function POST(req: Request) {
  try {
    const { game, category, previousQuestions = [] } = await req.json();

    if (!['trivia', 'wall', 'closest'].includes(game)) {
      return NextResponse.json({ error: 'Invalid game type' }, { status: 400 });
    }

    const prompt = buildPrompt(game, category, previousQuestions);

    const msg = await client.messages.create({
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

    const data = JSON.parse(text);

    // Shuffle wall items server-side
    if (game === 'wall' && Array.isArray(data.items)) {
      data.items = data.items
        .map((v: any) => ({ v, k: Math.random() }))
        .sort((a: any, b: any) => a.k - b.k)
        .map((o: any) => o.v);
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Question generation error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate question' },
      { status: 500 }
    );
  }
}

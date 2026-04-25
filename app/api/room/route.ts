import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchWikiImage } from '@/lib/wiki';

export const runtime = 'nodejs';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function buildTriviaFallbackPrompt(category: string, previousQuestions: string[]) {
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

function buildPrompt(game: string, category: string, previousQuestions: string[]) {
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

async function callClaude(prompt: string): Promise<any> {
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

async function generateQuestion(
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
      // Wiki fetch failed — regenerate as text-only
      try {
        return await callClaude(buildTriviaFallbackPrompt(category, previousQuestions));
      } catch {
        // Regeneration also failed — play original question without image
      }
    }
  }

  return data;
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create') {
      const { hostName, config } = body;
      let code = genCode();
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabaseAdmin
          .from('rooms').select('code').eq('code', code).maybeSingle();
        if (!existing) break;
        code = genCode();
      }

      const hostId = crypto.randomUUID();
      const { error } = await supabaseAdmin.from('rooms').insert({
        code,
        host_id: hostId,
        config,
        state: {
          phase: 'lobby',
          round: 0,
          currentGame: null,
          question: null,
          answers: {},
          wallPicks: {},
          pastQuestions: [],
        },
        players: [{ id: hostId, name: hostName, score: 0, isHost: true }],
      });
      if (error) throw error;
      return NextResponse.json({ code, playerId: hostId });
    }

    if (action === 'join') {
      const { code, name } = body;
      const { data: room, error } = await supabaseAdmin
        .from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
      if (error) throw error;
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (room.state.phase !== 'lobby') return NextResponse.json({ error: 'Game already started' }, { status: 400 });

      const playerId = crypto.randomUUID();
      const players = [...room.players, { id: playerId, name, score: 0, isHost: false }];
      const { error: e2 } = await supabaseAdmin.from('rooms')
        .update({ players }).eq('code', code.toUpperCase());
      if (e2) throw e2;
      return NextResponse.json({ code: code.toUpperCase(), playerId });
    }

    if (action === 'start') {
      const { code, playerId } = body;
      const { data: room } = await supabaseAdmin
        .from('rooms').select('*').eq('code', code).maybeSingle();
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (room.host_id !== playerId) return NextResponse.json({ error: 'Only host can start' }, { status: 403 });

      const game = pickOne<string>(room.config.games);
      const category = pickOne<string>(room.config.categories);
      const question = await generateQuestion(game as any, category, []);

      const state = {
        phase: 'answering',
        round: 1,
        currentGame: game,
        question,
        answers: {},
        wallPicks: {},
        pastQuestions: [question.question.slice(0, 80)],
      };
      const { error } = await supabaseAdmin.from('rooms').update({ state }).eq('code', code);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'answer') {
      const { code, playerId, answer, wallPicks } = body;
      const { data: room } = await supabaseAdmin
        .from('rooms').select('*').eq('code', code).maybeSingle();
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (room.state.phase !== 'answering') return NextResponse.json({ error: 'Not accepting answers' }, { status: 400 });

      const state = { ...room.state };
      state.answers = { ...state.answers, [playerId]: answer };
      if (wallPicks !== undefined) {
        state.wallPicks = { ...state.wallPicks, [playerId]: wallPicks };
      }
      const { error } = await supabaseAdmin.from('rooms').update({ state }).eq('code', code);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'reveal') {
      const { code, playerId } = body;
      const { data: room } = await supabaseAdmin
        .from('rooms').select('*').eq('code', code).maybeSingle();
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (room.host_id !== playerId) return NextResponse.json({ error: 'Only host can reveal' }, { status: 403 });

      const { state, players } = room;
      const q = state.question;
      const currentGame = state.currentGame;
      let newPlayers = [...players];

      if (currentGame === 'trivia') {
        newPlayers = players.map((p: any) => {
          const a = state.answers[p.id];
          return a === q.correctIndex ? { ...p, score: p.score + 1 } : p;
        });
      } else if (currentGame === 'wall') {
        newPlayers = players.map((p: any) => {
          const picks = state.wallPicks[p.id] || [];
          const correct = picks.filter((i: number) => q.items[i]?.correct).length;
          return { ...p, score: p.score + correct };
        });
      } else if (currentGame === 'closest') {
        let bestId = null, bestDiff = Infinity;
        players.forEach((p: any) => {
          const g = state.answers[p.id];
          if (g === undefined) return;
          const d = Math.abs(g - q.answer);
          if (d < bestDiff) { bestDiff = d; bestId = p.id; }
        });
        newPlayers = players.map((p: any) => p.id === bestId ? { ...p, score: p.score + 3 } : p);
      }

      const newState = { ...state, phase: 'revealing' };
      const { error } = await supabaseAdmin.from('rooms')
        .update({ state: newState, players: newPlayers }).eq('code', code);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'next') {
      const { code, playerId } = body;
      const { data: room } = await supabaseAdmin
        .from('rooms').select('*').eq('code', code).maybeSingle();
      if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      if (room.host_id !== playerId) return NextResponse.json({ error: 'Only host can advance' }, { status: 403 });

      const { config, state } = room;
      if (state.round >= config.rounds) {
        const newState = { ...state, phase: 'finished' };
        await supabaseAdmin.from('rooms').update({ state: newState }).eq('code', code);
        return NextResponse.json({ ok: true, finished: true });
      }

      const game = pickOne<string>(config.games);
      const category = pickOne<string>(config.categories);
      const question = await generateQuestion(game as any, category, state.pastQuestions);

      const newState = {
        phase: 'answering',
        round: state.round + 1,
        currentGame: game,
        question,
        answers: {},
        wallPicks: {},
        pastQuestions: [...state.pastQuestions, question.question.slice(0, 80)],
      };
      const { error } = await supabaseAdmin.from('rooms').update({ state: newState }).eq('code', code);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('Room API error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

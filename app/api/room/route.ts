import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateQuestion } from '@/lib/questions';

export const runtime = 'nodejs';

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
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
          return a === q.correctIndex ? { ...p, score: p.score + 8 } : p;
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
        newPlayers = players.map((p: any) => p.id === bestId ? { ...p, score: p.score + 8 } : p);
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

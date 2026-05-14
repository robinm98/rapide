import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateQuestion } from '@/lib/questions';
import { assignTriviaMeta, type TriviaKind, type Difficulty } from '@/lib/trivia-meta';

export const runtime = 'nodejs';

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

type QueueEntry = {
  game: string;
  category: string;
  triviaKind?: TriviaKind;
  subAngle?: string;
  difficulty?: Difficulty;
};

// The general subject stem of a generated question, for the cross-round exclusion list.
function subjectOf(question: any): string {
  if (question?.subject) return String(question.subject);
  if (question?.kind === 'ranking' && Array.isArray(question.items)) {
    return [...question.items].sort().join('|');
  }
  return String(question?.question ?? '').slice(0, 60);
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

      const baseQueue: QueueEntry[] = [];
      for (const g of room.config.games) {
        for (let i = 0; i < room.config.rounds; i++) {
          baseQueue.push({ game: g, category: pickOne<string>(room.config.categories) });
        }
      }
      const queue = assignTriviaMeta(baseQueue);
      const first = queue[0];
      const question = await generateQuestion(first.game as any, first.category, {
        avoidSubjects: [],
        avoidImageSubjects: [],
        triviaKind: first.triviaKind ?? 'text',
        subAngle: first.subAngle,
        difficulty: first.difficulty,
      });

      const subject = subjectOf(question);
      const pastImageSubjects = question.wikiQuery ? [question.wikiQuery] : [];

      const state = {
        phase: 'answering',
        round: 1,
        queue,
        queueIndex: 0,
        currentGame: first.game,
        question,
        answers: {},
        wallPicks: {},
        pastQuestions: [subject],
        pastImageSubjects,
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

      if (currentGame === 'trivia' && q?.kind === 'ranking') {
        const correct: number[] = q.correctOrder ?? [];
        newPlayers = players.map((p: any) => {
          const a = state.answers[p.id];
          if (!Array.isArray(a)) return p;
          let matches = 0;
          for (let i = 0; i < correct.length; i++) {
            if (a[i] === correct[i]) matches++;
          }
          return { ...p, score: p.score + matches * 2 };
        });
      } else if (currentGame === 'trivia') {
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

      const { state } = room;
      const queue: QueueEntry[] = state.queue ?? [];
      const nextIndex = (state.queueIndex ?? 0) + 1;

      if (nextIndex >= queue.length) {
        const newState = { ...state, phase: 'finished' };
        await supabaseAdmin.from('rooms').update({ state: newState }).eq('code', code);
        return NextResponse.json({ ok: true, finished: true });
      }

      const entry = queue[nextIndex];
      const prevSubjects: string[] = state.pastQuestions ?? [];
      const prevImageSubjects: string[] = state.pastImageSubjects ?? state.pastWikiSubjects ?? [];
      const question = await generateQuestion(entry.game as any, entry.category, {
        avoidSubjects: prevSubjects,
        avoidImageSubjects: prevImageSubjects,
        triviaKind: entry.triviaKind ?? 'text',
        subAngle: entry.subAngle,
        difficulty: entry.difficulty,
      });

      const subject = subjectOf(question);
      const nextImageSubjects = question.wikiQuery
        ? [...prevImageSubjects, question.wikiQuery]
        : prevImageSubjects;

      const newState = {
        ...state,
        phase: 'answering',
        round: state.round + 1,
        queueIndex: nextIndex,
        currentGame: entry.game,
        question,
        answers: {},
        wallPicks: {},
        pastQuestions: [...prevSubjects, subject],
        pastImageSubjects: nextImageSubjects,
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

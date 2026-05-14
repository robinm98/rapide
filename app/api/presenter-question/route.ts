import { NextResponse } from 'next/server';
import { generateQuestion, type QuestionOpts } from '@/lib/questions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { game, category } = body;
    if (!game || !category) {
      return NextResponse.json({ error: 'game and category required' }, { status: 400 });
    }
    const opts: QuestionOpts = {
      // Accept new names; fall back to legacy names for backwards compatibility.
      avoidSubjects: body.avoidSubjects ?? body.previousQuestions ?? [],
      avoidImageSubjects: body.avoidImageSubjects ?? body.avoidWikiSubjects ?? [],
      triviaKind: body.triviaKind ?? 'text',
      subAngle: body.subAngle,
      difficulty: body.difficulty,
    };
    const question = await generateQuestion(game, category, opts);
    return NextResponse.json(question);
  } catch (err: any) {
    console.error('Presenter question error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

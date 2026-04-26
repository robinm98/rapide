import { NextResponse } from 'next/server';
import { generateQuestion } from '@/lib/questions';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const { game, category, previousQuestions = [] } = await req.json();
    if (!game || !category) {
      return NextResponse.json({ error: 'game and category required' }, { status: 400 });
    }
    const question = await generateQuestion(game, category, previousQuestions);
    return NextResponse.json(question);
  } catch (err: any) {
    console.error('Presenter question error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}

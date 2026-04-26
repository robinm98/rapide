'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Shell, Btn, Tag } from '@/components/ui';
import { T, fontStack } from '@/lib/design';

// ─── Types ────────────────────────────────────────────────────────────────────

type GameType = 'trivia' | 'wall' | 'closest';

interface Player {
  id: string;
  name: string;
  score: number;
}

interface RoundEntry {
  game: GameType;
  category: string;
}

interface Question {
  question: string;
  imageFirst?: boolean;
  imageUrl?: string;
  choices?: string[];
  correctIndex?: number;
  explanation?: string;
  items?: { label: string; correct: boolean }[];
  criterion?: string;
  answer?: number;
  unit?: string;
}

type Phase = 'setup' | 'loading' | 'displaying' | 'revealing' | 'scoring' | 'results';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'General', 'History', 'Geography', 'Science', 'Cinema', 'TV & Series',
  'Music', 'Sports', 'Literature', 'Food & Drink', 'Pop Culture',
  'Tech & Internet', 'Art', 'Mythology', 'Video Games', 'Nature & Animals',
  'Space', 'Politics',
];

const GAMES: { key: GameType; title: string; desc: string }[] = [
  { key: 'trivia', title: 'Trivia', desc: 'Multiple-choice, one right answer.' },
  { key: 'wall', title: 'The Wall', desc: '12 items — pick the 8 that belong.' },
  { key: 'closest', title: 'The Closest', desc: 'Guess the number. Nearest wins.' },
];

const ROUNDS_OPTIONS = [3, 5, 7, 10];

// ─── Fisher-Yates shuffle ─────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickOne<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Build round queue ────────────────────────────────────────────────────────

function buildQueue(games: GameType[], categories: string[], roundsPerGame: number): RoundEntry[] {
  const entries: RoundEntry[] = [];
  for (const game of games) {
    for (let i = 0; i < roundsPerGame; i++) {
      entries.push({ game, category: pickOne(categories) });
    }
  }
  return shuffle(entries);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const mono = (size: number, extra?: React.CSSProperties): React.CSSProperties => ({
  fontFamily: fontStack.mono, fontSize: size, letterSpacing: '0.12em',
  textTransform: 'uppercase', ...extra,
});

function PlayerChip({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '6px 12px', border: `1px solid ${T.ink}`,
      fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.1em',
    }}>
      {name}
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: T.inkMute, fontSize: 14, lineHeight: 1, padding: 0,
      }}>×</button>
    </span>
  );
}

// ─── Setup Screen ─────────────────────────────────────────────────────────────

function SetupScreen({ onStart }: { onStart: (players: Player[], queue: RoundEntry[]) => void }) {
  const [playerInput, setPlayerInput] = useState('');
  const [players, setPlayers] = useState<string[]>([]);
  const [games, setGames] = useState<GameType[]>(['trivia']);
  const [categories, setCategories] = useState<string[]>(['General']);
  const [roundsPerGame, setRoundsPerGame] = useState(3);
  const [error, setError] = useState('');

  const addPlayer = () => {
    const n = playerInput.trim();
    if (!n) return;
    if (players.includes(n)) { setError('Name already added'); return; }
    setPlayers(p => [...p, n]);
    setPlayerInput('');
    setError('');
  };

  const removePlayer = (name: string) => setPlayers(p => p.filter(x => x !== name));

  const toggleGame = (key: GameType) => {
    setGames(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(g => g !== key) : prev
        : [...prev, key]
    );
  };

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat)
        ? prev.length > 1 ? prev.filter(c => c !== cat) : prev
        : [...prev, cat]
    );
  };

  const totalRounds = games.length * roundsPerGame;

  const handleStart = () => {
    if (players.length < 1) { setError('Add at least one player'); return; }
    const queue = buildQueue(games, categories, roundsPerGame);
    const playerObjects: Player[] = players.map((name, i) => ({
      id: String(i), name, score: 0,
    }));
    onStart(playerObjects, queue);
  };

  return (
    <Shell>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px clamp(16px, 4vw, 32px)' }}>
        <Tag color={T.accent}>Around the Table</Tag>
        <h1 style={{
          fontFamily: fontStack.display, fontSize: 'clamp(40px, 6vw, 72px)',
          fontWeight: 400, margin: '16px 0 48px', letterSpacing: '-0.02em',
        }}>
          Prepare the table.
        </h1>

        {/* Players */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 16 }) }}>§ 01 — Players</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              value={playerInput}
              onChange={e => setPlayerInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPlayer()}
              placeholder="Player name"
              style={{
                flex: 1, padding: '12px 16px', fontSize: 16,
                background: 'transparent', border: `1.5px solid ${T.ink}`,
                fontFamily: fontStack.body, color: T.ink, outline: 'none',
              }}
            />
            <Btn onClick={addPlayer} variant="ghost">Add</Btn>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {players.map(name => (
              <PlayerChip key={name} name={name} onRemove={() => removePlayer(name)} />
            ))}
          </div>
        </section>

        {/* Games */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 16 }) }}>§ 02 — Game modes ({games.length} selected)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {GAMES.map(g => {
              const sel = games.includes(g.key);
              return (
                <button key={g.key} onClick={() => toggleGame(g.key)} style={{
                  textAlign: 'left', padding: '16px 18px', cursor: 'pointer',
                  background: sel ? T.ink : 'transparent',
                  color: sel ? T.bg : T.ink,
                  border: `1.5px solid ${T.ink}`, fontFamily: fontStack.body,
                }}>
                  <div style={{ fontFamily: fontStack.display, fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{g.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>{g.desc}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Categories */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 16 }) }}>§ 03 — Categories ({categories.length} selected)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => {
              const sel = categories.includes(c);
              return (
                <button key={c} onClick={() => toggleCategory(c)} style={{
                  padding: '7px 12px', cursor: 'pointer',
                  background: sel ? T.accent : 'transparent',
                  color: sel ? '#FFF' : T.ink,
                  border: `1px solid ${sel ? T.accent : T.ink}`,
                  fontFamily: fontStack.mono, fontSize: 11,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{c}</button>
              );
            })}
          </div>
        </section>

        {/* Rounds per game */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 8 }) }}>§ 04 — Rounds per game</div>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 14 }) }}>
            {roundsPerGame} per game × {games.length} game{games.length !== 1 ? 's' : ''} = {totalRounds} total
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {ROUNDS_OPTIONS.map(n => (
              <button key={n} onClick={() => setRoundsPerGame(n)} style={{
                width: 52, height: 52, cursor: 'pointer',
                background: roundsPerGame === n ? T.ink : 'transparent',
                color: roundsPerGame === n ? T.bg : T.ink,
                border: `1.5px solid ${T.ink}`,
                fontFamily: fontStack.display, fontSize: 20, fontWeight: 500,
              }}>{n}</button>
            ))}
          </div>
        </section>

        {error && <div style={{ color: T.wrong, fontFamily: fontStack.mono, fontSize: 12, marginBottom: 16 }}>{error}</div>}

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="accent" onClick={handleStart}>Begin →</Btn>
        </div>
      </main>
    </Shell>
  );
}

// ─── Question Display ─────────────────────────────────────────────────────────

function QuestionDisplay({
  round, total, question, game, category, highlighted, onHighlight, onReveal,
}: {
  round: number; total: number; question: Question; game: GameType; category: string;
  highlighted: number | null; onHighlight: (i: number) => void; onReveal: () => void;
}) {
  const qStyle: React.CSSProperties = {
    fontFamily: fontStack.display,
    fontSize: 'clamp(28px, 4vw, 64px)',
    fontWeight: 400, lineHeight: 1.15,
    letterSpacing: '-0.02em', margin: '32px 0',
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px clamp(16px, 4vw, 48px)' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Tag color={T.inkMute}>Round {round}/{total}</Tag>
          <Tag color={T.accent}>{GAMES.find(g => g.key === game)?.title}</Tag>
          <Tag color={T.inkMute}>{category}</Tag>
        </div>
        <Btn variant="ghost" onClick={onReveal} style={{ fontSize: 11 }}>Reveal →</Btn>
      </div>

      {/* Image */}
      {question.imageUrl && (
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <img src={question.imageUrl} alt="question" style={{
            maxHeight: 'clamp(200px, 30vw, 400px)', maxWidth: '100%',
            border: `1px solid ${T.lineFade}`,
          }} />
        </div>
      )}

      {/* Question text */}
      <div style={qStyle}>{question.question}</div>

      {/* Trivia choices */}
      {game === 'trivia' && question.choices && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 8 }}>
          {question.choices.map((choice, i) => (
            <button key={i} onClick={() => onHighlight(i)} style={{
              textAlign: 'left', padding: '16px 20px', cursor: 'pointer',
              background: highlighted === i ? T.bgAlt : 'transparent',
              color: T.ink, border: `1.5px solid ${highlighted === i ? T.ink : T.lineFade}`,
              fontFamily: fontStack.body, fontSize: 'clamp(14px, 1.8vw, 20px)',
              transition: 'all 0.15s',
            }}>
              <span style={{ fontFamily: fontStack.mono, fontSize: 11, marginRight: 10, color: T.inkMute }}>
                {['A', 'B', 'C', 'D'][i]}
              </span>
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* Wall grid */}
      {game === 'wall' && question.items && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
          {question.items.map((item, i) => (
            <div key={i} style={{
              padding: '12px 14px', border: `1px solid ${T.lineFade}`,
              fontFamily: fontStack.body, fontSize: 'clamp(13px, 1.4vw, 16px)',
              textAlign: 'center',
            }}>{item.label}</div>
          ))}
        </div>
      )}

      {/* Closest — no input, just show question */}
      {game === 'closest' && question.unit && (
        <div style={{ ...mono(13, { color: T.inkMute, marginTop: 8 }) }}>Unit: {question.unit}</div>
      )}

      <div style={{ marginTop: 48, ...mono(11, { color: T.inkMute }) }}>
        Space to reveal · 1–4 to highlight choices
      </div>
    </div>
  );
}

// ─── Reveal Display ───────────────────────────────────────────────────────────

function RevealDisplay({
  round, total, question, game, category, onScore,
}: {
  round: number; total: number; question: Question; game: GameType; category: string;
  onScore: () => void;
}) {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px clamp(16px, 4vw, 48px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Tag color={T.inkMute}>Round {round}/{total}</Tag>
          <Tag color={T.accent}>{GAMES.find(g => g.key === game)?.title}</Tag>
          <Tag color={T.inkMute}>{category}</Tag>
        </div>
        <Btn variant="accent" onClick={onScore}>Score →</Btn>
      </div>

      {question.imageUrl && (
        <div style={{ marginBottom: 24, textAlign: 'center' }}>
          <img src={question.imageUrl} alt="question" style={{
            maxHeight: 'clamp(160px, 24vw, 320px)', maxWidth: '100%',
            border: `1px solid ${T.lineFade}`,
          }} />
        </div>
      )}

      <div style={{
        fontFamily: fontStack.display, fontSize: 'clamp(22px, 3vw, 48px)',
        fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.02em', margin: '24px 0',
      }}>{question.question}</div>

      {/* Trivia answer */}
      {game === 'trivia' && question.choices && question.correctIndex !== undefined && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 10 }) }}>Answer</div>
          <div style={{
            padding: '16px 20px', background: T.correctBg,
            border: `1.5px solid ${T.correct}`, display: 'inline-block',
            fontFamily: fontStack.body, fontSize: 'clamp(16px, 2vw, 28px)', color: T.correct,
          }}>
            <span style={{ fontFamily: fontStack.mono, fontSize: 11, marginRight: 10 }}>
              {['A', 'B', 'C', 'D'][question.correctIndex]}
            </span>
            {question.choices[question.correctIndex]}
          </div>
        </div>
      )}

      {/* Wall answer */}
      {game === 'wall' && question.items && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 10 }) }}>
            The 8 correct items
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {question.items.filter(it => it.correct).map((it, i) => (
              <span key={i} style={{
                padding: '8px 14px', background: T.correctBg,
                border: `1px solid ${T.correct}`, color: T.correct,
                fontFamily: fontStack.body, fontSize: 'clamp(13px, 1.5vw, 18px)',
              }}>{it.label}</span>
            ))}
          </div>
          {question.explanation && (
            <div style={{ marginTop: 12, color: T.inkMute, fontSize: 14, fontFamily: fontStack.body, maxWidth: 700 }}>
              {question.explanation}
            </div>
          )}
        </div>
      )}

      {/* Closest answer */}
      {game === 'closest' && question.answer !== undefined && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 10 }) }}>Answer</div>
          <div style={{
            fontFamily: fontStack.display, fontSize: 'clamp(36px, 5vw, 80px)',
            fontWeight: 400, color: T.correct,
          }}>
            {question.answer.toLocaleString()} <span style={{ fontSize: '0.4em', color: T.inkMute }}>{question.unit}</span>
          </div>
        </div>
      )}

      {question.explanation && game !== 'wall' && (
        <div style={{
          marginTop: 16, padding: '16px 20px', background: T.bgAlt,
          border: `1px solid ${T.lineFade}`, color: T.inkSoft,
          fontFamily: fontStack.body, fontSize: 'clamp(13px, 1.5vw, 17px)',
          maxWidth: 700, lineHeight: 1.6,
        }}>
          {question.explanation}
        </div>
      )}

      <div style={{ marginTop: 40, ...mono(11, { color: T.inkMute }) }}>Space to score</div>
    </div>
  );
}

// ─── Scoring Screen ───────────────────────────────────────────────────────────

function ScoringScreen({
  players, question, game, onDone,
}: {
  players: Player[]; question: Question; game: GameType;
  onDone: (deltas: Record<string, number>) => void;
}) {
  const [deltas, setDeltas] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map(p => [p.id, 0]))
  );
  const [closestWinner, setClosestWinner] = useState<string | null>(null);

  const setDelta = (id: string, val: number) => setDeltas(d => ({ ...d, [id]: val }));

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px clamp(16px, 4vw, 48px)' }}>
      <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 24 }) }}>
        § Score this round — {GAMES.find(g => g.key === game)?.title}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: `1px solid ${T.line}` }}>
        {players.map((p, idx) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: idx < players.length - 1 ? `1px solid ${T.lineFade}` : 'none',
          }}>
            <div>
              <div style={{ fontFamily: fontStack.display, fontSize: 22, fontWeight: 500 }}>{p.name}</div>
              <div style={{ ...mono(11, { color: T.inkMute }) }}>{p.score} pts total</div>
            </div>

            {/* Trivia: toggle +8 */}
            {game === 'trivia' && (
              <button onClick={() => setDelta(p.id, deltas[p.id] === 8 ? 0 : 8)} style={{
                padding: '10px 20px', cursor: 'pointer',
                background: deltas[p.id] === 8 ? T.correct : 'transparent',
                color: deltas[p.id] === 8 ? '#FFF' : T.ink,
                border: `1.5px solid ${deltas[p.id] === 8 ? T.correct : T.ink}`,
                fontFamily: fontStack.mono, fontSize: 13, letterSpacing: '0.1em',
                transition: 'all 0.15s',
              }}>
                {deltas[p.id] === 8 ? '✓ +8' : '+8'}
              </button>
            )}

            {/* Wall: stepper 0–8 */}
            {game === 'wall' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button onClick={() => setDelta(p.id, Math.max(0, deltas[p.id] - 1))} style={{
                  width: 36, height: 36, cursor: 'pointer', background: 'transparent',
                  border: `1px solid ${T.ink}`, fontFamily: fontStack.mono, fontSize: 18,
                }}>−</button>
                <div style={{
                  minWidth: 40, textAlign: 'center',
                  fontFamily: fontStack.display, fontSize: 28, fontWeight: 500,
                  color: deltas[p.id] > 0 ? T.correct : T.inkMute,
                }}>
                  {deltas[p.id]}
                </div>
                <button onClick={() => setDelta(p.id, Math.min(8, deltas[p.id] + 1))} style={{
                  width: 36, height: 36, cursor: 'pointer', background: 'transparent',
                  border: `1px solid ${T.ink}`, fontFamily: fontStack.mono, fontSize: 18,
                }}>+</button>
              </div>
            )}

            {/* Closest: single select +8 */}
            {game === 'closest' && (
              <button onClick={() => {
                const next = closestWinner === p.id ? null : p.id;
                setClosestWinner(next);
                const newDeltas = Object.fromEntries(players.map(pl => [pl.id, 0]));
                if (next) newDeltas[next] = 8;
                setDeltas(newDeltas);
              }} style={{
                padding: '10px 20px', cursor: 'pointer',
                background: closestWinner === p.id ? T.accent : 'transparent',
                color: closestWinner === p.id ? '#FFF' : T.ink,
                border: `1.5px solid ${closestWinner === p.id ? T.accent : T.ink}`,
                fontFamily: fontStack.mono, fontSize: 13, letterSpacing: '0.1em',
                transition: 'all 0.15s',
              }}>
                {closestWinner === p.id ? '★ Closest' : 'Closest?'}
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
        <Btn variant="accent" onClick={() => onDone(deltas)}>Next Round →</Btn>
      </div>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({ players, onNewGame, onHome }: {
  players: Player[]; onNewGame: () => void; onHome: () => void;
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px clamp(16px, 4vw, 48px)', textAlign: 'center' }}>
      <Tag color={T.accent}>Game Over</Tag>
      <div style={{
        fontFamily: fontStack.display,
        fontSize: 'clamp(56px, 8vw, 120px)',
        fontWeight: 400, letterSpacing: '-0.03em',
        lineHeight: 1, margin: '24px 0 8px',
      }}>
        {winner.name}
      </div>
      <div style={{ ...mono(13, { color: T.accent, marginBottom: 48 }) }}>Winner · {winner.score} pts</div>

      <div style={{ border: `1px solid ${T.line}`, marginBottom: 48 }}>
        {sorted.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 32px',
            borderBottom: i < sorted.length - 1 ? `1px solid ${T.lineFade}` : 'none',
            background: i === 0 ? T.bgAlt : 'transparent',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
              <span style={{ ...mono(11, { color: T.inkMute }), minWidth: 20 }}>#{i + 1}</span>
              <span style={{ fontFamily: fontStack.display, fontSize: 24, fontWeight: 500 }}>{p.name}</span>
            </div>
            <span style={{ fontFamily: fontStack.display, fontSize: 28, fontWeight: 400, color: i === 0 ? T.accent : T.ink }}>
              {p.score}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        <Btn variant="accent" onClick={onNewGame}>New Game →</Btn>
        <Btn variant="ghost" onClick={onHome}>← Home</Btn>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PresenterPage() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [players, setPlayers] = useState<Player[]>([]);
  const [queue, setQueue] = useState<RoundEntry[]>([]);
  const [roundIndex, setRoundIndex] = useState(0);
  const [question, setQuestion] = useState<Question | null>(null);
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [pastQuestions, setPastQuestions] = useState<string[]>([]);
  const [loadError, setLoadError] = useState('');
  const [showQuit, setShowQuit] = useState(false);

  const currentEntry = queue[roundIndex] ?? null;
  const totalRounds = queue.length;

  const fetchQuestion = useCallback(async (entry: RoundEntry, past: string[]) => {
    setPhase('loading');
    setLoadError('');
    try {
      const res = await fetch('/api/presenter-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: entry.game, category: entry.category, previousQuestions: past }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestion(data);
      setHighlighted(null);
      setPhase('displaying');
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load question');
      setPhase('displaying');
    }
  }, []);

  const handleStart = (newPlayers: Player[], newQueue: RoundEntry[]) => {
    setPlayers(newPlayers);
    setQueue(newQueue);
    setRoundIndex(0);
    setPastQuestions([]);
    fetchQuestion(newQueue[0], []);
  };

  const handleReveal = () => setPhase('revealing');
  const handleScore = () => setPhase('scoring');

  const handleDone = (deltas: Record<string, number>) => {
    const newPlayers = players.map(p => ({ ...p, score: p.score + (deltas[p.id] ?? 0) }));
    setPlayers(newPlayers);

    const q = question;
    if (q) {
      setPastQuestions(prev => [...prev, q.question.slice(0, 80)]);
    }

    const nextIndex = roundIndex + 1;
    if (nextIndex >= totalRounds) {
      setPhase('results');
    } else {
      setRoundIndex(nextIndex);
      fetchQuestion(queue[nextIndex], pastQuestions);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowQuit(q => !q);
        return;
      }
      if (showQuit) return;
      if (phase === 'displaying') {
        if (e.key === ' ') { e.preventDefault(); setPhase('revealing'); }
        if (e.key === '1') setHighlighted(0);
        if (e.key === '2') setHighlighted(1);
        if (e.key === '3') setHighlighted(2);
        if (e.key === '4') setHighlighted(3);
      }
      if (phase === 'revealing') {
        if (e.key === ' ') { e.preventDefault(); setPhase('scoring'); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phase, showQuit]);

  if (phase === 'setup') {
    return <SetupScreen onStart={handleStart} />;
  }

  if (phase === 'results') {
    return (
      <Shell hideHeader>
        <ResultsScreen
          players={players}
          onNewGame={() => setPhase('setup')}
          onHome={() => { window.location.href = '/'; }}
        />
      </Shell>
    );
  }

  return (
    <Shell hideHeader>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        {/* Quit confirm overlay */}
        {showQuit && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(26,24,21,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}>
            <div style={{
              background: T.bg, border: `1px solid ${T.line}`,
              padding: '48px', textAlign: 'center', maxWidth: 400,
            }}>
              <div style={{ fontFamily: fontStack.display, fontSize: 32, marginBottom: 16 }}>Quit the game?</div>
              <div style={{ color: T.inkMute, fontFamily: fontStack.mono, fontSize: 12, marginBottom: 32 }}>All progress will be lost.</div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Btn variant="accent" onClick={() => { setPhase('setup'); setShowQuit(false); }}>Quit</Btn>
                <Btn variant="ghost" onClick={() => setShowQuit(false)}>Continue</Btn>
              </div>
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
            <div style={{ fontFamily: fontStack.display, fontSize: 48, opacity: 0.4, letterSpacing: '-0.02em' }}>
              Generating…
            </div>
          </div>
        )}

        {loadError && phase === 'displaying' && (
          <div style={{ padding: 32, color: T.wrong, fontFamily: fontStack.mono, fontSize: 14 }}>
            Error: {loadError}
            <Btn variant="ghost" onClick={() => currentEntry && fetchQuestion(currentEntry, pastQuestions)} style={{ marginLeft: 16 }}>
              Retry
            </Btn>
          </div>
        )}

        {phase === 'displaying' && question && currentEntry && (
          <QuestionDisplay
            round={roundIndex + 1}
            total={totalRounds}
            question={question}
            game={currentEntry.game}
            category={currentEntry.category}
            highlighted={highlighted}
            onHighlight={setHighlighted}
            onReveal={handleReveal}
          />
        )}

        {phase === 'revealing' && question && currentEntry && (
          <RevealDisplay
            round={roundIndex + 1}
            total={totalRounds}
            question={question}
            game={currentEntry.game}
            category={currentEntry.category}
            onScore={handleScore}
          />
        )}

        {phase === 'scoring' && question && currentEntry && (
          <ScoringScreen
            players={players}
            question={question}
            game={currentEntry.game}
            onDone={handleDone}
          />
        )}

        {/* Esc hint */}
        {phase !== 'loading' && (
          <div style={{
            position: 'fixed', bottom: 16, right: 24,
            ...mono(10, { color: T.inkMute }),
          }}>
            Esc to quit
          </div>
        )}
      </div>
    </Shell>
  );
}

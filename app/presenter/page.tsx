'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Shell, Btn, Tag } from '@/components/ui';
import { T, fontStack } from '@/lib/design';

// ─── Types ────────────────────────────────────────────────────────────────────

type GameType = 'trivia' | 'wall' | 'closest';
type TriviaKind = 'text' | 'image' | 'ranking';

interface Player {
  id: string;
  name: string;
  score: number;
}

interface RoundEntry {
  game: GameType;
  category: string;
  triviaKind?: TriviaKind;
}

interface Question {
  question: string;
  imageFirst?: boolean;
  imageUrl?: string;
  choices?: string[];
  correctIndex?: number;
  explanation?: string;
  // wall
  items?: any[];
  criterion?: string;
  // closest
  answer?: number;
  unit?: string;
  // ranking
  kind?: 'ranking';
  correctOrder?: number[];
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
  // For each trivia round, pre-decide its kind: 25% image, 50% text, 25% ranking, at random indices.
  const triviaIndices: number[] = [];
  entries.forEach((e, i) => { if (e.game === 'trivia') triviaIndices.push(i); });
  const total = triviaIndices.length;
  if (total > 0) {
    const imageCount = Math.round(total * 0.25);
    const rankingCount = Math.round(total * 0.25);
    const shuffled = triviaIndices
      .map(i => ({ i, k: Math.random() }))
      .sort((a, b) => a.k - b.k)
      .map(o => o.i);
    const imageSet = new Set(shuffled.slice(0, imageCount));
    const rankingSet = new Set(shuffled.slice(imageCount, imageCount + rankingCount));
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].game !== 'trivia') continue;
      entries[i].triviaKind = imageSet.has(i) ? 'image' : rankingSet.has(i) ? 'ranking' : 'text';
    }
  }
  return entries;
}

// ─── Local storage helpers (persist across sessions) ─────────────────────────

const RECENT_Q_KEY = 'salon_recent_questions';
const RECENT_WIKI_KEY = 'salon_recent_wiki_subjects';

function readRecentQuestions(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_Q_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function appendRecentQuestion(q: string) {
  try {
    const existing = readRecentQuestions();
    const updated = [...new Set([...existing, q])].slice(-100);
    localStorage.setItem(RECENT_Q_KEY, JSON.stringify(updated));
  } catch {}
}

function readRecentWikiSubjects(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_WIKI_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function appendRecentWikiSubject(subject: string) {
  try {
    const existing = readRecentWikiSubjects();
    const updated = [...new Set([...existing, subject])].slice(-100);
    localStorage.setItem(RECENT_WIKI_KEY, JSON.stringify(updated));
  } catch {}
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
  round, total, question, game, category, highlighted, onHighlight, onReveal, isMobile,
}: {
  round: number; total: number; question: Question; game: GameType; category: string;
  highlighted: number | null; onHighlight: (i: number) => void; onReveal: () => void;
  isMobile: boolean;
}) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 1400,
      width: '100%',
      margin: '0 auto',
      padding: 'clamp(16px, 3vw, 32px) clamp(16px, 4vw, 48px)',
    }}>
      {/* Top banner */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.inkMute }}>
            Round {round}/{total}
          </span>
          <Tag color={T.accent}>{GAMES.find(g => g.key === game)?.title}</Tag>
          {question.kind === 'ranking' && <Tag color={T.inkMute}>Ranking</Tag>}
          <Tag color={T.inkMute}>{category}</Tag>
        </div>
      </div>

      {/* Centered content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'clamp(24px, 4vw, 64px) 0',
        gap: 'clamp(20px, 3vh, 40px)',
      }}>
        {question.imageUrl && (
          <img src={question.imageUrl} alt="question" style={{
            display: 'block',
            maxHeight: 'clamp(180px, 30vh, 400px)', maxWidth: '100%',
            border: `1px solid ${T.lineFade}`,
          }} />
        )}

        <div style={{
          fontFamily: fontStack.display,
          fontSize: 'clamp(28px, 4vw, 64px)',
          fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.02em',
          maxWidth: 1100,
        }}>{question.question}</div>

        {game === 'trivia' && question.kind !== 'ranking' && question.choices && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, maxWidth: 1000, width: '100%' }}>
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

        {game === 'trivia' && question.kind === 'ranking' && question.items && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 800, width: '100%', textAlign: 'left' }}>
            {(question.items as string[]).map((label, i) => (
              <div key={i} style={{
                padding: '14px 18px', border: `1px solid ${T.lineFade}`,
                fontFamily: fontStack.body, fontSize: 'clamp(15px, 1.8vw, 22px)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>{label}</span>
                <span style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.15em' }}>
                  {String.fromCharCode(65 + i)}
                </span>
              </div>
            ))}
          </div>
        )}

        {game === 'wall' && question.items && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`,
            gap: 8, maxWidth: 1200, width: '100%',
          }}>
            {question.items.map((item: any, i: number) => (
              <div key={i} style={{
                padding: '12px 14px', border: `1px solid ${T.lineFade}`,
                fontFamily: fontStack.body, fontSize: 'clamp(13px, 1.4vw, 18px)',
                textAlign: 'center',
              }}>{item.label}</div>
            ))}
          </div>
        )}

        {game === 'closest' && question.unit && (
          <div style={{ ...mono(13, { color: T.inkMute }) }}>Unit: {question.unit}</div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        marginTop: 'auto',
      }}>
        <Btn variant="ghost" onClick={onReveal}>Reveal →</Btn>
        <div className="kbd-hint" style={{ ...mono(11, { color: T.inkMute }) }}>
          Space to reveal · 1–4 to highlight choices
        </div>
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
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 1400,
      width: '100%',
      margin: '0 auto',
      padding: 'clamp(16px, 3vw, 32px) clamp(16px, 4vw, 48px)',
    }}>
      {/* Top banner */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.inkMute }}>
            Round {round}/{total}
          </span>
          <Tag color={T.accent}>{GAMES.find(g => g.key === game)?.title}</Tag>
          {question.kind === 'ranking' && <Tag color={T.inkMute}>Ranking</Tag>}
          <Tag color={T.inkMute}>{category}</Tag>
        </div>
      </div>

      {/* Centered content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'clamp(24px, 4vw, 64px) 0',
        gap: 'clamp(16px, 2.5vh, 32px)',
      }}>
        {question.imageUrl && (
          <img src={question.imageUrl} alt="question" style={{
            display: 'block',
            maxHeight: 'clamp(140px, 24vh, 320px)', maxWidth: '100%',
            border: `1px solid ${T.lineFade}`,
          }} />
        )}

        <div style={{
          fontFamily: fontStack.display, fontSize: 'clamp(22px, 3vw, 48px)',
          fontWeight: 400, lineHeight: 1.15, letterSpacing: '-0.02em',
          maxWidth: 1100,
        }}>{question.question}</div>

        {game === 'trivia' && question.kind !== 'ranking' && question.choices && question.correctIndex !== undefined && (
          <div>
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

        {game === 'trivia' && question.kind === 'ranking' && question.items && question.correctOrder && (
          <div style={{ width: '100%', maxWidth: 800, textAlign: 'left' }}>
            <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 10 }) }}>Correct order</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {question.correctOrder.map((itemIdx, rankIdx) => (
                <div key={rankIdx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', background: T.correctBg,
                  border: `1px solid ${T.correct}`, color: T.correct,
                  fontFamily: fontStack.body, fontSize: 'clamp(15px, 1.8vw, 22px)',
                }}>
                  <span style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                    <span style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em' }}>
                      {String(rankIdx + 1).padStart(2, '0')}
                    </span>
                    <span>{(question.items as string[])[itemIdx]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {game === 'wall' && question.items && (
          <div>
            <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 10 }) }}>The 8 correct items</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {question.items.filter(it => it.correct).map((it, i) => (
                <span key={i} style={{
                  padding: '8px 14px', background: T.correctBg,
                  border: `1px solid ${T.correct}`, color: T.correct,
                  fontFamily: fontStack.body, fontSize: 'clamp(13px, 1.5vw, 18px)',
                }}>{it.label}</span>
              ))}
            </div>
          </div>
        )}

        {game === 'closest' && question.answer !== undefined && (
          <div>
            <div style={{ ...mono(11, { color: T.inkMute, marginBottom: 10 }) }}>Answer</div>
            <div style={{
              fontFamily: fontStack.display, fontSize: 'clamp(36px, 5vw, 80px)',
              fontWeight: 400, color: T.correct,
            }}>
              {question.answer.toLocaleString()} <span style={{ fontSize: '0.4em', color: T.inkMute }}>{question.unit}</span>
            </div>
          </div>
        )}

        {question.explanation && (
          <div style={{
            padding: '16px 20px', background: T.bgAlt,
            border: `1px solid ${T.lineFade}`, color: T.inkSoft,
            fontFamily: fontStack.body, fontSize: 'clamp(13px, 1.5vw, 17px)',
            maxWidth: 700, lineHeight: 1.6,
          }}>
            {question.explanation}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        marginTop: 'auto',
      }}>
        <Btn variant="accent" onClick={onScore}>Score →</Btn>
        <div className="kbd-hint" style={{ ...mono(11, { color: T.inkMute }) }}>Space to score</div>
      </div>
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
  const isRanking = question.kind === 'ranking';
  const useStepper = game === 'wall' || (game === 'trivia' && isRanking);
  const [deltas, setDeltas] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.map(p => [p.id, 0]))
  );
  const [closestWinner, setClosestWinner] = useState<string | null>(null);

  const setDelta = (id: string, val: number) => setDeltas(d => ({ ...d, [id]: val }));

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: 900,
      width: '100%',
      margin: '0 auto',
      padding: 'clamp(16px, 3vw, 32px) clamp(16px, 4vw, 48px)',
    }}>
      <div style={{ ...mono(11, { color: T.inkMute }) }}>
        § Score this round — {GAMES.find(g => g.key === game)?.title}{isRanking ? ' · Ranking' : ''}
      </div>
      {isRanking && (
        <div style={{ ...mono(11, { color: T.inkMute, marginTop: 6 }) }}>
          +2 per item in correct position
        </div>
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 'clamp(24px, 4vh, 48px) 0',
      }}>
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

            {/* Trivia (choice): toggle +8 */}
            {game === 'trivia' && !isRanking && (
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

            {/* Wall and Trivia ranking: stepper 0–8 */}
            {useStepper && (
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
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
        <Btn variant="accent" onClick={() => onDone(deltas)}>Next Round →</Btn>
      </div>
    </div>
  );
}

// ─── Results Screen ───────────────────────────────────────────────────────────

function ResultsScreen({ players, onNewGame }: {
  players: Player[]; onNewGame: () => void;
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const currentEntry = queue[roundIndex] ?? null;
  const totalRounds = queue.length;

  const fetchQuestion = useCallback(async (entry: RoundEntry, past: string[]) => {
    setPhase('loading');
    setLoadError('');
    try {
      const recent = readRecentQuestions();
      const combined = [...new Set([...recent, ...past])].slice(-50);
      const avoidWikiSubjects = readRecentWikiSubjects();
      const res = await fetch('/api/presenter-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game: entry.game,
          category: entry.category,
          previousQuestions: combined,
          avoidWikiSubjects,
          triviaKind: entry.triviaKind ?? 'text',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      appendRecentQuestion(data.question.slice(0, 80));
      if (data.wikiQuery) appendRecentWikiSubject(data.wikiQuery);
      if (data.kind === 'ranking' && Array.isArray(data.items)) {
        appendRecentWikiSubject([...data.items].sort().join('|'));
      }
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

    const newPast = question
      ? [...pastQuestions, question.question.slice(0, 80)]
      : pastQuestions;
    setPastQuestions(newPast);

    const nextIndex = roundIndex + 1;
    if (nextIndex >= totalRounds) {
      setPhase('results');
    } else {
      setRoundIndex(nextIndex);
      fetchQuestion(queue[nextIndex], newPast);
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
      <Shell>
        <ResultsScreen
          players={players}
          onNewGame={() => setPhase('setup')}
        />
      </Shell>
    );
  }

  return (
    <Shell confirmLeave>
      <div style={{
        minHeight: '100dvh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}>
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
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
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
            isMobile={isMobile}
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
          <div className="kbd-hint" style={{
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

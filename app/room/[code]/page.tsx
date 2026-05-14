'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Shell, Btn, Tag, SkipButton } from '@/components/ui';
import { T, fontStack } from '@/lib/design';

type Player = { id: string; name: string; score: number; isHost?: boolean };
type Room = {
  code: string;
  host_id: string;
  config: { games: string[]; categories: string[]; rounds: number };
  state: any;
  players: Player[];
};

function gameLabel(game: string) {
  if (game === 'trivia') return 'TRIVIA';
  if (game === 'wall') return 'THE WALL';
  return 'THE CLOSEST';
}

export default function RoomPage({ params }: { params: { code: string } }) {
  const router = useRouter();
  const code = params.code.toUpperCase();
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [myWallPicks, setMyWallPicks] = useState<number[]>([]);
  const [closestInput, setClosestInput] = useState('');
  const [myRanks, setMyRanks] = useState<(number | null)[]>([null, null, null, null]);
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipError, setSkipError] = useState('');
  const [skipNotice, setSkipNotice] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const prevSkipCountRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const pid = sessionStorage.getItem(`salon_player_${code}`);
    if (!pid) { router.push('/'); return; }
    setPlayerId(pid);

    const load = async () => {
      const { data, error } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle();
      if (error || !data) { setError('Room not found'); setLoading(false); return; }
      setRoom(data as Room);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`room-${code}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        payload => {
          setRoom(payload.new as Room);
          if ((payload.new as any).state?.phase === 'answering') {
            setMyWallPicks([]);
            setClosestInput('');
            setMyRanks([null, null, null, null]);
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [code, router]);

  // Show a one-off notice to non-host players when the host skips a question.
  useEffect(() => {
    const sc = room?.state?.skipCount ?? 0;
    const amHost = !!room && room.host_id === playerId;
    if (prevSkipCountRef.current === null) {
      prevSkipCountRef.current = sc;
      return;
    }
    if (sc > prevSkipCountRef.current) {
      prevSkipCountRef.current = sc;
      if (!amHost) {
        setSkipNotice(true);
        const t = setTimeout(() => setSkipNotice(false), 4000);
        return () => clearTimeout(t);
      }
    } else {
      prevSkipCountRef.current = sc;
    }
  }, [room, playerId]);

  const callAPI = async (action: string, extra: any = {}) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, code, playerId, ...extra }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  };

  // Host-only: discard the current question and pull a fresh one for the same
  // round. A failure is shown inline and leaves the original question in place.
  const doSkip = async () => {
    setSkipping(true);
    setSkipError('');
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip', code, playerId }),
      });
      const data = await res.json();
      if (data.error) setSkipError("Couldn't generate a new question. Try again.");
    } catch {
      setSkipError("Couldn't generate a new question. Try again.");
    }
    setSkipping(false);
  };

  if (loading) {
    return (
      <Shell>
        <main style={{ padding: '120px clamp(16px, 4vw, 32px)', textAlign: 'center' }}>
          <div style={{ fontFamily: fontStack.mono, fontSize: 12, color: T.inkMute, animation: 'pulse 1.5s ease-in-out infinite' }}>LOADING ROOM…</div>
        </main>
      </Shell>
    );
  }

  if (error || !room) {
    return (
      <Shell>
        <main style={{ padding: '120px clamp(16px, 4vw, 32px)', textAlign: 'center' }}>
          <Tag color={T.wrong}>Error</Tag>
          <div style={{ fontFamily: fontStack.display, fontSize: 32, margin: '16px 0 24px' }}>{error || 'Something went wrong'}</div>
        </main>
      </Shell>
    );
  }

  const isHost = room.host_id === playerId;
  const { state, config } = room;

  // ================= LOBBY =================
  if (state.phase === 'lobby') {
    const catLabel = config.categories.length <= 3
      ? config.categories.map((c: string) => c.toUpperCase()).join(', ')
      : `${config.categories.length} CATEGORIES`;
    const gamesLabel = config.games.map(gameLabel).join(' · ');
    return (
      <Shell>
        <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px clamp(16px, 4vw, 32px)' }}>
          <Tag color={T.accent}>Waiting for players…</Tag>
          <h1 style={{ fontFamily: fontStack.display, fontSize: 'clamp(60px, 12vw, 140px)', fontWeight: 500, margin: '16px 0 8px', letterSpacing: '0.2em', textAlign: 'center' }}>
            {code}
          </h1>
          <p style={{ textAlign: 'center', color: T.inkSoft, fontFamily: fontStack.mono, fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Share this code with friends
          </p>

          <div style={{ marginTop: 48, padding: 24, background: T.bgAlt, border: `1px solid ${T.lineFade}` }}>
            <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 }}>
              Players · {room.players.length}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {room.players.map(p => (
                <div key={p.id} style={{
                  padding: '8px 14px', background: p.id === playerId ? T.ink : T.bg,
                  color: p.id === playerId ? T.bg : T.ink,
                  border: `1px solid ${T.ink}`, fontFamily: fontStack.body, fontSize: 14,
                }}>
                  {p.name}{p.isHost ? ' ★' : ''}
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 32, fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, textAlign: 'center' }}>
            {gamesLabel} · {catLabel} · {config.rounds} ROUNDS
          </div>

          <div style={{ marginTop: 40, textAlign: 'center' }}>
            {isHost ? (
              <Btn variant="accent" onClick={() => callAPI('start')} disabled={room.players.length < 1 || submitting}>
                {submitting ? 'Starting…' : 'Start the Game →'}
              </Btn>
            ) : (
              <div style={{ fontFamily: fontStack.display, fontSize: 20, fontStyle: 'italic', color: T.inkSoft }}>
                Waiting for the host to begin…
              </div>
            )}
          </div>
        </main>
      </Shell>
    );
  }

  // ================= FINISHED =================
  if (state.phase === 'finished') {
    const ranked = [...room.players].sort((a, b) => b.score - a.score);
    const winner = ranked[0];
    return (
      <Shell>
        <main style={{ maxWidth: 900, margin: '0 auto', padding: '80px clamp(16px, 4vw, 32px)', textAlign: 'center' }}>
          <Tag color={T.accent}>Final Standings</Tag>
          <h1 style={{ fontFamily: fontStack.display, fontSize: 'clamp(48px, 8vw, 88px)', fontWeight: 400, margin: '24px 0 8px', letterSpacing: '-0.03em', lineHeight: 1 }}>
            <em style={{ fontWeight: 300 }}>{winner.name}</em>
          </h1>
          <p style={{ fontFamily: fontStack.mono, fontSize: 12, letterSpacing: '0.2em', color: T.inkMute, textTransform: 'uppercase', marginBottom: 60 }}>
            — takes the evening —
          </p>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {ranked.map((p, i) => (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                padding: '20px 0', borderBottom: `1px solid ${i === 0 ? T.ink : T.lineFade}`, textAlign: 'left',
              }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em', color: T.inkMute }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={{ fontFamily: fontStack.display, fontSize: i === 0 ? 32 : 22, fontWeight: i === 0 ? 600 : 400 }}>
                    {p.name}
                  </span>
                </div>
                <span style={{ fontFamily: fontStack.display, fontSize: i === 0 ? 40 : 26, fontWeight: 600, color: i === 0 ? T.accent : T.ink }}>
                  {p.score}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 60 }}>
            <Btn variant="accent" onClick={() => router.push('/')}>New Game →</Btn>
          </div>
        </main>
      </Shell>
    );
  }

  // ================= IN GAME =================
  const q = state.question;
  const currentGame: string = state.currentGame || 'trivia';
  const iAnswered = state.answers[playerId] !== undefined;
  const answerCount = Object.keys(state.answers).length;
  const everyoneAnswered = answerCount === room.players.length;

  return (
    <Shell confirmLeave fitViewport={state.phase === 'answering'}>
      <main
        className={state.phase === 'answering' ? 'game-screen' : undefined}
        style={{ maxWidth: 1100, width: '100%', margin: '0 auto', padding: 'clamp(16px, 4vw, 32px)' }}
      >
        <div className="game-screen-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: skipError || skipNotice ? 16 : 32, paddingBottom: 20, borderBottom: `1px solid ${T.lineFade}`, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            Round {(state.queueIndex ?? 0) + 1} / {state.queue?.length ?? config.rounds}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isHost && state.phase === 'answering' && (
              <SkipButton onClick={doSkip} loading={skipping} />
            )}
            <Tag color={T.accent}>Room {code}</Tag>
          </div>
        </div>
        {skipError && (
          <div style={{ marginBottom: 24, fontFamily: fontStack.mono, fontSize: 11, color: T.wrong }}>
            {skipError}
          </div>
        )}
        {skipNotice && (
          <div style={{ marginBottom: 24, fontFamily: fontStack.mono, fontSize: 11, color: T.accent }}>
            The host skipped this question — a new one is coming.
          </div>
        )}

        {/* Scoreboard */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
          {room.players.map(p => (
            <div key={p.id} style={{
              padding: '10px 14px',
              background: p.id === playerId ? T.ink : T.bgAlt,
              color: p.id === playerId ? T.bg : T.ink,
              border: `1px solid ${p.id === playerId ? T.ink : T.lineFade}`,
              fontFamily: fontStack.mono, fontSize: 12, display: 'flex', gap: 12, alignItems: 'baseline',
            }}>
              <span>{p.name}{state.answers[p.id] !== undefined ? ' ✓' : ''}</span>
              <span style={{ fontFamily: fontStack.display, fontSize: 18, fontWeight: 600, color: T.accent }}>
                {p.score}
              </span>
            </div>
          ))}
        </div>
        </div>

        <div className="game-screen-main">
        <div className="fade-up" style={{ marginBottom: 40 }}>
          {/* Round mode banner */}
          <div style={{
            display: 'inline-block',
            padding: '6px 14px',
            background: T.accent,
            color: '#FFF',
            fontFamily: fontStack.mono,
            fontSize: 13,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 20,
          }}>
            Round {(state.queueIndex ?? 0) + 1} · {gameLabel(currentGame)}
            {currentGame === 'trivia' && q.kind === 'ranking' && ' · RANKING'}
          </div>

          {q.imageUrl && (
            <img
              src={q.imageUrl}
              alt=""
              style={{
                display: 'block',
                marginBottom: 20,
                maxWidth: isMobile ? '100%' : 480,
                maxHeight: isMobile ? 240 : 'min(320px, 40vh)',
                width: isMobile ? '100%' : 'auto',
                height: 'auto',
                objectFit: 'contain',
                border: `1.5px solid ${T.ink}`,
              }}
            />
          )}
          <h2 style={{ fontFamily: fontStack.display, fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.01em', margin: 0 }}>
            {q.question}
          </h2>
          {currentGame === 'wall' && q.criterion && (
            <div style={{ marginTop: 12, fontFamily: fontStack.mono, fontSize: 12, color: T.inkSoft }}>
              Criterion: {q.criterion} · Pick 8
            </div>
          )}
          {currentGame === 'closest' && q.unit && (
            <div style={{ marginTop: 12, fontFamily: fontStack.mono, fontSize: 12, color: T.inkSoft }}>
              Answer in: {q.unit}
            </div>
          )}
        </div>

        {/* TRIVIA — choice (text/image) */}
        {currentGame === 'trivia' && q.kind !== 'ranking' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {q.choices.map((choice: string, idx: number) => {
              const isCorrect = idx === q.correctIndex;
              const myChoice = state.answers[playerId] === idx;
              const pickedBy = room.players.filter(p => state.answers[p.id] === idx);
              let bg = T.bg, color = T.ink, border = T.ink;
              if (state.phase === 'revealing') {
                if (isCorrect) { bg = T.correctBg; color = T.correct; border = T.correct; }
                else if (pickedBy.length > 0) { bg = T.wrongBg; color = T.wrong; border = T.wrong; }
              } else if (myChoice) { bg = T.ink; color = T.bg; border = T.ink; }

              const canClick = state.phase === 'answering' && !iAnswered;
              return (
                <button key={idx} disabled={!canClick} onClick={() => callAPI('answer', { answer: idx })} style={{
                  padding: '24px 20px', textAlign: 'left', cursor: canClick ? 'pointer' : 'default',
                  background: bg, color, border: `1.5px solid ${border}`,
                  fontFamily: fontStack.body, fontSize: 17, lineHeight: 1.3,
                  minHeight: isMobile ? 80 : undefined,
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                }}>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.1em', opacity: 0.6, marginTop: 4, minWidth: 20 }}>
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <span style={{ flex: 1 }}>{choice}</span>
                  {state.phase === 'revealing' && pickedBy.length > 0 && (
                    <span style={{ fontFamily: fontStack.mono, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                      {pickedBy.map(p => p.name).join(', ')}
                    </span>
                  )}
                  {state.phase === 'revealing' && isCorrect && (
                    <span style={{ fontFamily: fontStack.mono, fontSize: 10, letterSpacing: '0.1em' }}>✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* TRIVIA — ranking */}
        {currentGame === 'trivia' && q.kind === 'ranking' && (() => {
          const items: string[] = q.items ?? [];
          const correctOrder: number[] = q.correctOrder ?? [];
          const canTap = state.phase === 'answering' && !iAnswered;

          const tap = (idx: number) => {
            if (!canTap) return;
            setMyRanks(prev => {
              const cur = prev[idx];
              if (cur !== null) {
                return prev.map((r, i) => i === idx ? null : (r !== null && r > cur ? r - 1 : r));
              }
              const used = prev.filter(r => r !== null) as number[];
              const next = used.length + 1;
              if (next > 4) return prev;
              return prev.map((r, i) => i === idx ? next : r);
            });
          };

          const allRanked = myRanks.every(r => r !== null);
          const submit = () => {
            const order = [1, 2, 3, 4].map(rank => myRanks.indexOf(rank));
            callAPI('answer', { answer: order });
          };

          return (
            <>
              {state.phase === 'answering' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {!iAnswered && items.map((item, idx) => {
                    const rank = myRanks[idx];
                    const ranked = rank !== null;
                    return (
                      <button
                        key={idx}
                        disabled={!canTap}
                        onClick={() => tap(idx)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '18px 20px', cursor: canTap ? 'pointer' : 'default',
                          background: 'transparent', color: T.ink,
                          border: `1.5px solid ${ranked ? T.ink : T.lineFade}`,
                          fontFamily: fontStack.body, fontSize: 17, textAlign: 'left',
                          minHeight: isMobile ? 64 : undefined,
                        }}
                      >
                        <span style={{ flex: 1 }}>{item}</span>
                        <span style={{
                          fontFamily: fontStack.mono, fontSize: 13, letterSpacing: '0.15em',
                          color: ranked ? T.accent : T.inkMute,
                          minWidth: 32, textAlign: 'right',
                        }}>
                          {ranked ? String(rank).padStart(2, '0') : '—'}
                        </span>
                      </button>
                    );
                  })}
                  {!iAnswered && (
                    <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute }}>
                        Tap to rank · {myRanks.filter(r => r !== null).length} / 4
                      </div>
                      <Btn onClick={submit} disabled={!allRanked || submitting}>
                        Lock in ranking
                      </Btn>
                    </div>
                  )}
                  {iAnswered && (
                    <div style={{ marginTop: 12, padding: 16, background: T.bgAlt, fontFamily: fontStack.mono, fontSize: 12, textAlign: 'center', color: T.inkSoft }}>
                      Your ranking is locked in. Waiting for others…
                    </div>
                  )}
                </div>
              )}
              {state.phase === 'revealing' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Correct order */}
                  <div>
                    <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Correct order
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', alignItems: 'baseline' }}>
                      {correctOrder.map((itemIdx, rankIdx) => (
                        <div key={rankIdx} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <span style={{ fontFamily: fontStack.mono, fontSize: 12, letterSpacing: '0.15em', color: T.inkMute }}>
                            {rankIdx + 1}.
                          </span>
                          <span style={{ fontFamily: fontStack.display, fontSize: 'clamp(18px, 2.2vw, 22px)', fontWeight: 500, color: T.ink }}>
                            {items[itemIdx]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-player rows */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {room.players.map((p, pIdx) => {
                      const submitted: number[] = Array.isArray(state.answers[p.id]) ? state.answers[p.id] : [];
                      const matches = submitted.reduce((acc, itemIdx, rankIdx) => (
                        acc + (itemIdx === correctOrder[rankIdx] ? 1 : 0)
                      ), 0);
                      const isMe = p.id === playerId;
                      return (
                        <div key={p.id} style={{
                          padding: '16px 0 16px 14px',
                          borderTop: pIdx === 0 ? `1px solid ${T.lineFade}` : 'none',
                          borderBottom: `1px solid ${T.lineFade}`,
                          borderLeft: isMe ? `2px solid ${T.accent}` : '2px solid transparent',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                            <span style={{
                              fontFamily: fontStack.mono, fontSize: 13, letterSpacing: '0.15em',
                              textTransform: 'uppercase', color: isMe ? T.accent : T.ink,
                              fontWeight: 600,
                            }}>
                              {isMe ? 'You' : p.name}
                            </span>
                            <span style={{ fontFamily: fontStack.mono, fontSize: 12, color: T.inkSoft }}>
                              {matches} / 4
                            </span>
                          </div>
                          {submitted.length === 4 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 8 }}>
                              {submitted.map((itemIdx, rankIdx) => {
                                const correct = itemIdx === correctOrder[rankIdx];
                                return (
                                  <span key={rankIdx} style={{
                                    fontFamily: fontStack.body,
                                    fontSize: 14,
                                    color: correct ? T.ink : T.inkMute,
                                    opacity: correct ? 1 : 0.6,
                                    textDecoration: correct ? 'none' : 'line-through',
                                  }}>
                                    <span style={{ fontFamily: fontStack.mono, fontSize: 11, marginRight: 4, color: T.inkMute }}>
                                      {rankIdx + 1}.
                                    </span>
                                    {items[itemIdx]} {correct ? '✓' : '✗'}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ marginTop: 8, fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, fontStyle: 'italic' }}>
                              No submission
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* WALL — answering */}
        {currentGame === 'wall' && state.phase === 'answering' && (
          <>
            {!iAnswered && (
              <div style={{ marginBottom: 16, fontFamily: fontStack.mono, fontSize: 12, color: T.inkSoft }}>
                Selected {myWallPicks.length} / 8
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`, gap: 8 }}>
              {q.items.map((item: any, idx: number) => {
                const picked = myWallPicks.includes(idx);
                const bg = picked ? T.ink : T.bg;
                const color = picked ? T.bg : T.ink;
                const canClick = !iAnswered;
                return (
                  <button key={idx} disabled={!canClick} onClick={() => {
                    if (picked) setMyWallPicks(myWallPicks.filter(i => i !== idx));
                    else if (myWallPicks.length < 8) setMyWallPicks([...myWallPicks, idx]);
                  }} style={{
                    aspectRatio: '1.3', padding: 16, cursor: canClick ? 'pointer' : 'default',
                    background: bg, color, border: `1.5px solid ${T.ink}`,
                    fontFamily: fontStack.body, fontSize: isMobile ? 13 : 14, lineHeight: 1.2,
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left',
                  }}>
                    <span style={{ fontFamily: fontStack.mono, fontSize: 10, opacity: 0.5 }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <span style={{ fontWeight: 500 }}>{item.label}</span>
                  </button>
                );
              })}
            </div>
            {!iAnswered && (
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                <Btn onClick={() => callAPI('answer', { answer: myWallPicks.length, wallPicks: myWallPicks })} disabled={myWallPicks.length === 0 || submitting}>
                  Lock in {myWallPicks.length} picks
                </Btn>
              </div>
            )}
          </>
        )}

        {/* WALL — reveal */}
        {currentGame === 'wall' && state.phase === 'revealing' && (() => {
          const wallPicks: Record<string, number[]> = state.wallPicks ?? {};
          const playersWhoPicked = (itemIdx: number) =>
            room.players.filter(p => (wallPicks[p.id] ?? []).includes(itemIdx));

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isMobile ? 2 : 4}, 1fr)`, gap: 8 }}>
                {q.items.map((item: any, idx: number) => {
                  const pickedBy = playersWhoPicked(idx);
                  const correct = item.correct;
                  return (
                    <div key={idx} style={{
                      aspectRatio: '1.3',
                      padding: 14,
                      background: correct ? T.bgAlt : T.bg,
                      border: `1.5px solid ${correct ? T.accent : T.lineFade}`,
                      color: correct ? T.ink : T.inkMute,
                      fontFamily: fontStack.body, fontSize: isMobile ? 13 : 14, lineHeight: 1.2,
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                      textAlign: 'left',
                      opacity: correct ? 1 : 0.85,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontFamily: fontStack.mono, fontSize: 10, opacity: 0.5 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        {correct && (
                          <span style={{ fontFamily: fontStack.mono, fontSize: 12, color: T.accent }}>✓</span>
                        )}
                      </div>
                      <div style={{
                        fontWeight: 500,
                        color: correct ? T.ink : T.inkMute,
                      }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontFamily: fontStack.mono, fontSize: 9,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        color: T.inkMute, lineHeight: 1.4,
                        display: 'flex', flexWrap: 'wrap', gap: '2px 6px',
                        minHeight: 12,
                      }}>
                        {pickedBy.length === 0 ? (
                          <span style={{ opacity: 0.4 }}>—</span>
                        ) : (
                          pickedBy.map((p, i) => {
                            const isMe = p.id === playerId;
                            return (
                              <span key={p.id}>
                                <span style={{
                                  color: isMe ? T.accent : T.inkSoft,
                                  fontWeight: isMe ? 600 : 400,
                                }}>
                                  {isMe ? 'You' : p.name}
                                </span>
                                {i < pickedBy.length - 1 && <span style={{ color: T.inkMute }}>{' · '}</span>}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Per-player score delta */}
              <div>
                <div style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 10 }}>
                  This round
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {room.players.map((p, pIdx) => {
                    const picks: number[] = wallPicks[p.id] ?? [];
                    const correctCount = picks.filter(i => q.items[i]?.correct).length;
                    const isMe = p.id === playerId;
                    return (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                        padding: '10px 14px',
                        borderTop: pIdx === 0 ? `1px solid ${T.lineFade}` : 'none',
                        borderBottom: `1px solid ${T.lineFade}`,
                        borderLeft: isMe ? `2px solid ${T.accent}` : '2px solid transparent',
                      }}>
                        <span style={{
                          fontFamily: fontStack.mono, fontSize: 12, letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          color: isMe ? T.accent : T.ink,
                          fontWeight: 600,
                        }}>
                          {isMe ? 'You' : p.name}
                        </span>
                        <span style={{ fontFamily: fontStack.mono, fontSize: 12, color: T.inkSoft }}>
                          +{correctCount} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })()}

        {/* CLOSEST */}
        {currentGame === 'closest' && (
          <>
            {state.phase === 'answering' && !iAnswered && (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={closestInput}
                  onChange={e => setClosestInput(e.target.value)}
                  placeholder="Your guess…"
                  autoFocus
                  style={{
                    flex: isMobile ? '1 1 100%' : '1 1 200px',
                    minWidth: 0, padding: 20,
                    fontSize: 'clamp(20px, 5vw, 28px)',
                    fontFamily: fontStack.display, background: 'transparent',
                    border: `1.5px solid ${T.ink}`, color: T.ink, outline: 'none',
                  }}
                />
                <Btn onClick={() => {
                  const n = parseFloat(closestInput);
                  if (!isNaN(n)) callAPI('answer', { answer: n });
                }} disabled={submitting || !closestInput.trim()} style={isMobile ? { width: '100%' } : {}}>Submit</Btn>
              </div>
            )}
            {state.phase === 'answering' && iAnswered && (
              <div style={{ padding: 20, background: T.bgAlt, fontFamily: fontStack.mono, fontSize: 14, textAlign: 'center' }}>
                Your guess is locked in. Waiting for others…
              </div>
            )}
            {state.phase === 'revealing' && (
              <div>
                <div style={{ textAlign: 'center', padding: '40px 20px', background: T.bgAlt, marginBottom: 24, border: `1px solid ${T.line}` }}>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.2em', marginBottom: 12 }}>THE ANSWER</div>
                  <div style={{ fontFamily: fontStack.display, fontSize: 72, fontWeight: 500, color: T.accent, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {Number(q.answer).toLocaleString()}
                  </div>
                  <div style={{ fontFamily: fontStack.mono, fontSize: 12, color: T.inkSoft, marginTop: 8 }}>{q.unit}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...room.players].map(p => ({
                    ...p, guess: state.answers[p.id], diff: Math.abs((state.answers[p.id] ?? Infinity) - q.answer),
                  })).sort((a, b) => a.diff - b.diff).map((p, i) => (
                    <div key={p.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '16px 20px',
                      background: i === 0 ? T.correctBg : T.bg,
                      border: `1px solid ${i === 0 ? T.correct : T.lineFade}`,
                      color: i === 0 ? T.correct : T.ink,
                    }}>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'baseline' }}>
                        <span style={{ fontFamily: fontStack.mono, fontSize: 11 }}>#{i + 1}</span>
                        <span style={{ fontFamily: fontStack.display, fontSize: 22, fontWeight: 500 }}>{p.name}</span>
                        {i === 0 && <Tag color={T.correct}>+8 pts</Tag>}
                      </div>
                      <div style={{ fontFamily: fontStack.mono, fontSize: 14 }}>
                        {p.guess?.toLocaleString() ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        </div>

        <div className="game-screen-footer">
        {/* Footer controls */}
        <div style={{ marginTop: 40, paddingTop: 32, borderTop: `1px solid ${T.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          {state.phase === 'answering' && (
            <>
              <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute }}>
                {answerCount} / {room.players.length} answered
              </div>
              {isHost && (
                <Btn variant="accent" onClick={() => callAPI('reveal')} disabled={!everyoneAnswered || submitting}>
                  {everyoneAnswered ? 'Reveal the Answer →' : 'Waiting…'}
                </Btn>
              )}
            </>
          )}
          {state.phase === 'revealing' && (
            <>
              <div style={{ maxWidth: 600, fontSize: 14, color: T.inkSoft, fontStyle: 'italic', fontFamily: fontStack.body }}>
                {q.explanation}
              </div>
              {isHost && (
                <Btn variant="accent" onClick={() => callAPI('next')} disabled={submitting}>
                  {(state.queueIndex ?? 0) + 1 >= (state.queue?.length ?? config.rounds) ? 'See Results →' : 'Next Round →'}
                </Btn>
              )}
              {!isHost && (
                <div style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute }}>
                  Host is choosing the next round…
                </div>
              )}
            </>
          )}
        </div>
        </div>
      </main>
    </Shell>
  );
}

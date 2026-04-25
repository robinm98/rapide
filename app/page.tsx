'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shell, Btn, Tag } from '@/components/ui';
import { T, fontStack } from '@/lib/design';

const CATEGORIES = [
  'General',
  'History',
  'Geography',
  'Science',
  'Cinema',
  'TV & Series',
  'Music',
  'Sports',
  'Literature',
  'Food & Drink',
  'Pop Culture',
  'Tech & Internet',
  'Art',
  'Mythology',
  'Video Games',
  'Nature & Animals',
  'Space',
  'Politics',
];

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'home' | 'create' | 'join'>('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [game, setGame] = useState('trivia');
  const [categories, setCategories] = useState<string[]>(['General']);
  const [rounds, setRounds] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleCategory = (cat: string) => {
    setCategories(prev =>
      prev.includes(cat)
        ? prev.length > 1 ? prev.filter(c => c !== cat) : prev
        : [...prev, cat]
    );
  };

  const allSelected = categories.length === CATEGORIES.length;

  const createRoom = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          hostName: name.trim(),
          config: { game, categories, rounds },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      sessionStorage.setItem(`salon_player_${data.code}`, data.playerId);
      router.push(`/room/${data.code}`);
    } catch (e: any) {
      setError(e.message); setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!name.trim() || !code.trim()) { setError('Enter your name and a room code'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', code: code.trim(), name: name.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      sessionStorage.setItem(`salon_player_${data.code}`, data.playerId);
      router.push(`/room/${data.code}`);
    } catch (e: any) {
      setError(e.message); setLoading(false);
    }
  };

  if (view === 'home') {
    return (
      <Shell>
        <main style={{ maxWidth: 1100, margin: '0 auto', padding: '80px clamp(16px, 4vw, 32px) 60px' }}>
          <div className="fade-up" style={{ marginBottom: 80 }}>
            <Tag color={T.accent}>◆ Choose your table</Tag>
            <h1 style={{
              fontFamily: fontStack.display, fontSize: 'clamp(48px, 8vw, 96px)',
              fontWeight: 400, lineHeight: 0.95, margin: '24px 0 16px',
              letterSpacing: '-0.03em',
            }}>
              An evening of<br />
              <em style={{ fontWeight: 300 }}>curious</em> questions,
              <br />answered together.
            </h1>
            <p style={{ fontSize: 18, maxWidth: 560, color: T.inkSoft, lineHeight: 1.6, margin: '24px 0 0' }}>
              A quiz game for small gatherings. Create a room, share the code, play from any phone.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', borderTop: `1px solid ${T.line}` }}>
            {[
              { key: 'create', num: '01', title: 'Host a Room', desc: 'Create a game, share the 4-letter code with friends.', tag: 'Host' },
              { key: 'join', num: '02', title: 'Join a Room', desc: 'Someone sent you a code? Enter it and hop in.', tag: 'Guest' },
            ].map((m, i) => (
              <button key={m.key} onClick={() => { setView(m.key as any); setError(''); }} style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderRight: i === 0 ? `1px solid ${T.line}` : 'none',
                borderBottom: `1px solid ${T.line}`,
                padding: '48px clamp(16px, 4vw, 32px)', textAlign: 'left', color: T.ink,
                transition: 'background 0.2s',
              }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = T.bgAlt}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40 }}>
                  <span style={{ fontFamily: fontStack.mono, fontSize: 11, color: T.inkMute, letterSpacing: '0.15em' }}>№ {m.num}</span>
                  <Tag color={T.inkMute}>{m.tag}</Tag>
                </div>
                <h2 style={{ fontFamily: fontStack.display, fontSize: 36, fontWeight: 500, margin: '0 0 12px', letterSpacing: '-0.02em' }}>
                  {m.title}
                </h2>
                <p style={{ margin: 0, color: T.inkSoft, lineHeight: 1.5, fontSize: 15 }}>{m.desc}</p>
                <div style={{ marginTop: 32, fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  Enter →
                </div>
              </button>
            ))}
          </div>
        </main>
      </Shell>
    );
  }

  if (view === 'join') {
    return (
      <Shell>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '48px clamp(16px, 4vw, 32px)' }}>
          <button onClick={() => setView('home')} style={{
            background: 'none', border: 'none', color: T.inkMute, cursor: 'pointer',
            fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em',
            textTransform: 'uppercase', padding: 0, marginBottom: 32,
          }}>← Back</button>
          <Tag color={T.accent}>Join a Room</Tag>
          <h1 style={{ fontFamily: fontStack.display, fontSize: 56, fontWeight: 400, margin: '16px 0 40px', letterSpacing: '-0.02em' }}>
            Enter the code.
          </h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
              style={{ padding: '16px 18px', fontSize: 18, background: 'transparent', border: `1.5px solid ${T.ink}`, fontFamily: fontStack.body, color: T.ink, outline: 'none' }} />
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={4}
              style={{ padding: '20px', fontSize: 36, background: 'transparent', border: `1.5px solid ${T.ink}`, fontFamily: fontStack.display, color: T.ink, outline: 'none', textAlign: 'center', letterSpacing: '0.3em' }} />
            {error && <div style={{ color: T.wrong, fontFamily: fontStack.mono, fontSize: 12 }}>{error}</div>}
            <Btn variant="accent" onClick={joinRoom} disabled={loading}>
              {loading ? 'Joining…' : 'Join →'}
            </Btn>
          </div>
        </main>
      </Shell>
    );
  }

  // Create view
  return (
    <Shell>
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '48px clamp(16px, 4vw, 32px)' }}>
        <button onClick={() => setView('home')} style={{
          background: 'none', border: 'none', color: T.inkMute, cursor: 'pointer',
          fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em',
          textTransform: 'uppercase', padding: 0, marginBottom: 32,
        }}>← Back</button>
        <Tag color={T.accent}>Host a Room</Tag>
        <h1 style={{ fontFamily: fontStack.display, fontSize: 56, fontWeight: 400, margin: '16px 0 40px', letterSpacing: '-0.02em' }}>
          Prepare the table.
        </h1>

        <section style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 16 }}>§ 01 — Your name</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            style={{ width: '100%', padding: '16px 18px', fontSize: 18, background: 'transparent', border: `1.5px solid ${T.ink}`, fontFamily: fontStack.body, color: T.ink, outline: 'none' }} />
        </section>

        <section style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 16 }}>§ 02 — Choose a game</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {[
              { key: 'trivia', title: 'Trivia', desc: 'Classic multiple-choice. Four options, one right.' },
              { key: 'wall', title: 'The Wall', desc: '12 items. Pick the 8 that belong.' },
              { key: 'closest', title: 'The Closest', desc: 'Answer with a number. Nearest wins.' },
            ].map(g => (
              <button key={g.key} onClick={() => setGame(g.key)} style={{
                textAlign: 'left', padding: 20, cursor: 'pointer',
                background: game === g.key ? T.ink : T.bg,
                color: game === g.key ? T.bg : T.ink,
                border: `1.5px solid ${T.ink}`, fontFamily: fontStack.body,
              }}>
                <div style={{ fontFamily: fontStack.display, fontSize: 22, fontWeight: 500, marginBottom: 6 }}>{g.title}</div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>{g.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <div style={{
            fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em',
            textTransform: 'uppercase', color: T.inkMute, marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>§ 03 — Categories ({categories.length} selected)</span>
            <button onClick={() => setCategories(allSelected ? ['General'] : [...CATEGORIES])} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: T.inkMute,
              fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em',
              textTransform: 'uppercase', padding: 0,
            }}>
              {allSelected ? 'Clear' : 'Select All'}
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIES.map(c => {
              const selected = categories.includes(c);
              return (
                <button key={c} onClick={() => toggleCategory(c)} style={{
                  padding: '8px 14px', cursor: 'pointer',
                  background: selected ? T.accent : 'transparent',
                  color: selected ? '#FFF' : T.ink,
                  border: `1px solid ${selected ? T.accent : T.ink}`,
                  fontFamily: fontStack.mono, fontSize: 11,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>{c}</button>
              );
            })}
          </div>
        </section>

        <section style={{ marginBottom: 40 }}>
          <div style={{ fontFamily: fontStack.mono, fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: T.inkMute, marginBottom: 16 }}>§ 04 — How many rounds</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[3, 5, 7, 10].map(n => (
              <button key={n} onClick={() => setRounds(n)} style={{
                width: 56, height: 56, cursor: 'pointer',
                background: rounds === n ? T.ink : 'transparent',
                color: rounds === n ? T.bg : T.ink,
                border: `1.5px solid ${T.ink}`,
                fontFamily: fontStack.display, fontSize: 20, fontWeight: 500,
              }}>{n}</button>
            ))}
          </div>
        </section>

        {error && <div style={{ color: T.wrong, fontFamily: fontStack.mono, fontSize: 12, marginBottom: 16 }}>{error}</div>}

        <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
          <Btn variant="accent" onClick={createRoom} disabled={loading}>
            {loading ? 'Creating…' : 'Create Room →'}
          </Btn>
        </div>
      </main>
    </Shell>
  );
}

'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { T, fontStack } from '@/lib/design';

export const Btn = ({ children, onClick, variant = 'primary', disabled, style = {}, type = 'button' }: any) => {
  const variants: any = {
    primary: { bg: T.ink, color: T.bg, border: T.ink },
    ghost: { bg: 'transparent', color: T.ink, border: T.ink },
    accent: { bg: T.accent, color: '#FFF', border: T.accent },
    soft: { bg: T.bgAlt, color: T.ink, border: T.lineFade },
  };
  const v = variants[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '14px 24px',
        background: v.bg,
        color: v.color,
        border: `1.5px solid ${v.border}`,
        borderRadius: 0,
        fontFamily: fontStack.mono,
        fontSize: 12,
        fontWeight: 500,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'transform 0.2s',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.transform = 'translate(-2px,-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translate(0,0)'; }}
    >
      {children}
    </button>
  );
};

export const Tag = ({ children, color = T.ink }: any) => (
  <span style={{
    fontFamily: fontStack.mono, fontSize: 10, letterSpacing: '0.15em',
    textTransform: 'uppercase', color, border: `1px solid ${color}`,
    padding: '4px 10px', display: 'inline-block'
  }}>{children}</span>
);

// Quiet host-only escape hatch shown on question screens. Discreet by design —
// it must not compete with the primary Reveal action.
export const SkipButton = ({ onClick, loading, style = {} }: { onClick: () => void; loading?: boolean; style?: React.CSSProperties }) => (
  <button
    onClick={onClick}
    disabled={loading}
    style={{
      padding: '6px 12px',
      border: `1px solid ${T.lineFade}`,
      background: 'transparent',
      borderRadius: 0,
      cursor: loading ? 'default' : 'pointer',
      fontFamily: fontStack.mono,
      fontSize: 10,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color: T.inkMute,
      opacity: loading ? 0.5 : 1,
      transition: 'color 0.15s',
      ...style,
    }}
    onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.color = T.ink; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.inkMute; }}
  >
    {loading ? 'Skipping…' : 'Skip'}
  </button>
);

const HomeButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 12px',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      fontFamily: fontStack.mono,
      fontSize: 11,
      letterSpacing: '0.15em',
      textTransform: 'uppercase',
      color: T.inkSoft,
      transition: 'color 0.15s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.ink; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.inkSoft; }}
  >
    ← Home
  </button>
);

type ShellProps = {
  children?: React.ReactNode;
  hideHeader?: boolean;
  showHome?: boolean;
  onHomeClick?: () => void;
  confirmLeave?: boolean;
  fitViewport?: boolean;
};

export const Shell = ({ children, hideHeader, showHome, onHomeClick, confirmLeave, fitViewport }: ShellProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const resolvedShowHome = showHome ?? (pathname !== '/');
  const goHome = () => {
    if (confirmLeave && typeof window !== 'undefined'
        && !window.confirm('Leave the game? Your progress will be lost.')) {
      return;
    }
    if (onHomeClick) onHomeClick();
    else router.push('/');
  };
  return (
    <div className={`shell-root${fitViewport ? ' shell-fit' : ''}`} style={{
      display: 'flex',
      flexDirection: 'column',
      background: T.bg, color: T.ink,
      fontFamily: fontStack.body,
      backgroundImage: `radial-gradient(${T.lineFade} 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {!hideHeader && (
        <header style={{
          width: '100%',
          maxWidth: 1100, margin: '0 auto',
          padding: 'clamp(20px, 4vw, 28px) clamp(16px, 4vw, 32px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: `1px solid ${T.lineFade}`,
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flexShrink: 1 }}>
            {resolvedShowHome && <HomeButton onClick={goHome} />}
            <div
              onClick={() => router.push('/')}
              style={{ display: 'flex', alignItems: 'baseline', gap: 14, cursor: 'pointer', minWidth: 0 }}
            >
              <div style={{ fontFamily: fontStack.display, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
                Salon<span style={{ color: T.accent }}>.</span>
              </div>
              <div
                className="shell-header-tagline"
                style={{ fontFamily: fontStack.mono, fontSize: 10, color: T.inkMute, letterSpacing: '0.15em', textTransform: 'uppercase' }}
              >
                A Parlor Game
              </div>
            </div>
          </div>
          <span className="shell-header-est">
            <Tag color={T.inkMute}>Est. 2026</Tag>
          </span>
        </header>
      )}
      {children}
    </div>
  );
};

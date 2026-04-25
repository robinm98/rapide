'use client';
import React from 'react';
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

export const Shell = ({ children, hideHeader }: any) => (
  <div style={{
    minHeight: '100vh', background: T.bg, color: T.ink,
    fontFamily: fontStack.body,
    backgroundImage: `radial-gradient(${T.lineFade} 1px, transparent 1px)`,
    backgroundSize: '24px 24px',
  }}>
    {!hideHeader && (
      <header style={{
        maxWidth: 1100, margin: '0 auto', padding: '28px 32px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${T.lineFade}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <div style={{ fontFamily: fontStack.display, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
            Salon<span style={{ color: T.accent }}>.</span>
          </div>
          <div style={{ fontFamily: fontStack.mono, fontSize: 10, color: T.inkMute, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            A Parlor Game
          </div>
        </div>
        <Tag color={T.inkMute}>Est. 2026</Tag>
      </header>
    )}
    {children}
  </div>
);

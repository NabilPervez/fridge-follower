import type { CSSProperties, ReactNode } from 'react';
import { CaretLeft, Check, Plus, type Icon, type IconWeight } from '@phosphor-icons/react';
import type { Level, Slot } from '../data/db';
import { JEWEL, rgba, type Jewel } from '../domain/constants';
import { meter } from '../domain/levels';
import { SLOT_ICON, useBack } from './helpers';

export function Meter({ level }: { level: Level }) {
  const m = meter(level);
  return (
    <div className="meter" aria-label={`Level ${m.label.toLowerCase()}`}>
      <span className="meter__label" style={{ color: m.labelColor }}>
        {m.label}
      </span>
      <span className="meter__track">
        <span className="meter__fill" style={{ width: m.width, background: m.fill, boxShadow: m.glow }} />
      </span>
    </div>
  );
}

export function StockDot({ color, size = 8 }: { color: string; size?: number }) {
  return <span className="sdot" style={{ flexBasis: size, width: size, height: size, background: color, boxShadow: `0 0 ${size - 2}px ${color}` }} />;
}

export function IconButton({
  label,
  onClick,
  icon: I,
  weight = 'duotone',
  variant,
  size,
  style,
  children,
}: {
  label: string;
  onClick: () => void;
  icon: Icon;
  weight?: IconWeight;
  variant?: 'ghost' | 'violet';
  size?: number;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`icon-btn${variant ? ` icon-btn--${variant}` : ''}`}
      style={{ ...(size ? { fontSize: size } : null), ...style }}
    >
      <I weight={weight} />
      {children}
    </button>
  );
}

export function BackButton({ fallback, solid }: { fallback?: string; solid?: boolean }) {
  const back = useBack(fallback);
  return <IconButton label="Back" icon={CaretLeft} weight="bold" variant={solid ? undefined : 'ghost'} size={solid ? 22 : 24} onClick={back} />;
}

export interface SlotCardProps {
  slot: Slot;
  label: string;
  jewel: Jewel;
  title: string | null;
  muted?: boolean;
  cooked?: boolean;
  dot?: string | null;
  onOpen: () => void;
  onToggleCook?: () => void;
}

export function SlotCard({ slot, label, jewel, title, muted, cooked, dot, onOpen, onToggleCook }: SlotCardProps) {
  const [base, tint] = JEWEL[jewel];
  const filled = title !== null;
  const I = SLOT_ICON[slot];
  return (
    <div className="glass slot-card">
      <button type="button" className="slot-card__main" onClick={onOpen}>
        <div className="tile" style={{ background: rgba(base, filled ? 0.22 : 0.1), color: filled ? tint : rgba(tint, 0.6) }}>
          <I weight="duotone" />
        </div>
        <div className="slot-card__text">
          <span className="slot-card__label">{label}</span>
          <div className="slot-card__line">
            {dot && !cooked && <StockDot color={dot} />}
            <span
              className="slot-card__title ellipsis"
              style={{
                color: !filled ? '#7F7CA0' : cooked ? '#A9A6C4' : muted ? '#C8C5DE' : '#F3F1FA',
                textDecoration: cooked ? 'line-through' : 'none',
              }}
            >
              {title ?? 'Add a meal'}
            </span>
          </div>
        </div>
      </button>
      {filled ? (
        <button
          type="button"
          aria-label={cooked ? 'Mark not cooked' : 'Mark cooked'}
          aria-pressed={!!cooked}
          onClick={onToggleCook}
          className="square-btn"
          style={{
            border: `1.5px solid ${cooked ? 'transparent' : 'rgba(255,255,255,.18)'}`,
            background: cooked ? 'linear-gradient(135deg,#3FD1A6,#0F9D76)' : 'transparent',
            color: cooked ? '#06110D' : '#A9A6C4',
          }}
        >
          <Check weight="bold" />
        </button>
      ) : (
        <button type="button" aria-label="Add" onClick={onOpen} className="square-btn square-btn--add">
          <Plus weight="bold" />
        </button>
      )}
    </div>
  );
}

export function Toggle({ on }: { on: boolean }) {
  return <span className="toggle" data-on={on} aria-hidden />;
}

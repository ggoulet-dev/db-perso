import { useState } from 'react';

interface Props {
  value: number;
  onChange(value: number): void;
  min?: number;
  max?: number;
  className?: string;
  'aria-label'?: string;
  title?: string;
}

const INTEGER = /^\s*-?\d+\s*$/;

/**
 * Champ entier : garde le texte saisi tant qu'il a le focus (« - », vide…) et ne remonte
 * que des entiers valides, bornés ; ↑/↓ ajoutent 1 (10 avec Maj).
 */
export function NumberField({ value, onChange, min = -Infinity, max = Infinity, className, ...rest }: Props) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      className={`num-field${className ? ` ${className}` : ''}`}
      value={text ?? String(value)}
      onFocus={(e) => {
        setText(String(value));
        e.target.select();
      }}
      onBlur={() => setText(null)}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        if (INTEGER.test(next)) onChange(clamp(Number(next)));
      }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
        const next = clamp(value + step);
        setText(String(next));
        onChange(next);
      }}
    />
  );
}

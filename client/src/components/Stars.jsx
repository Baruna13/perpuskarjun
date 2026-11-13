import { Star } from 'lucide-react';

export function Stars({ value = 0, size = 14 }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-resin">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} className={i <= Math.round(value) ? '' : 'text-rule'} />
      ))}
    </span>
  );
}

export function StarInput({ value, onChange }) {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(i)} className="text-resin transition hover:scale-110" aria-label={`${i} bintang`}>
          <Star size={26} fill={i <= value ? 'currentColor' : 'none'} className={i <= value ? '' : 'text-rule'} />
        </button>
      ))}
    </span>
  );
}

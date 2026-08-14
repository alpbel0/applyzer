type CharCounterProps = {
  current: number;
  maximum: number;
};

export function CharCounter({ current, maximum }: CharCounterProps) {
  const nearLimit = current >= maximum * 0.9;

  return (
    <span
      className={`font-data text-xs ${nearLimit ? "font-semibold text-[color:var(--honey-deep)]" : "text-[color:var(--ink-faint)]"}`}
      aria-live="polite"
    >
      {current}/{maximum}
    </span>
  );
}

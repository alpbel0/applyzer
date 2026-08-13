type CharCounterProps = {
  current: number;
  maximum: number;
};

export function CharCounter({ current, maximum }: CharCounterProps) {
  const nearLimit = current >= maximum * 0.9;

  return (
    <span
      className={`text-xs tabular-nums ${nearLimit ? "font-semibold text-[#a85d00]" : "text-[#777f90]"}`}
      aria-live="polite"
    >
      {current}/{maximum}
    </span>
  );
}

import type { HTMLAttributes } from "react";

export function Badge({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-[#16213e]/10 bg-white/70 px-3 py-1.5 text-xs font-semibold tracking-wide text-[#38425a] ${className}`}
      {...props}
    />
  );
}

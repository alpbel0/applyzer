import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[1.75rem] border border-white/80 bg-white/92 shadow-[0_24px_80px_rgba(22,33,62,0.1)] backdrop-blur ${className}`}
      {...props}
    />
  );
}

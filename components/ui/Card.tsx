import type { HTMLAttributes } from "react";

export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-[1.25rem] border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[0_1px_2px_rgba(20,23,31,0.04)] ${className}`}
      {...props}
    />
  );
}

import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "bg-[color:var(--ink)] text-[color:var(--paper)] hover:bg-[#0b0d13] focus-visible:ring-[color:var(--ink)]",
  secondary:
    "border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:border-[color:var(--ink)] hover:bg-[color:var(--paper)] focus-visible:ring-[color:var(--ink)]",
  ghost:
    "bg-transparent text-[color:var(--ink-soft)] hover:bg-[color:var(--paper)] focus-visible:ring-[color:var(--ink)]",
} as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { className = "", variant = "primary", type = "button", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-55 ${variants[variant]} ${className}`}
        {...props}
      />
    );
  },
);

import { forwardRef, type ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variants = {
  primary:
    "bg-[#16213e] text-white shadow-[0_12px_30px_rgba(22,33,62,0.2)] hover:bg-[#0f1930] focus-visible:ring-[#16213e]",
  secondary:
    "border border-[#d7d9df] bg-white text-[#16213e] hover:border-[#16213e] hover:bg-[#f8f7f2] focus-visible:ring-[#16213e]",
  ghost:
    "bg-transparent text-[#596174] hover:bg-[#f2f0e9] focus-visible:ring-[#16213e]",
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

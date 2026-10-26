/**
 * Button styles as class strings, so links, buttons and form submits all
 * look identical without a wrapper component per element type.
 */

export type ButtonVariant = "primary" | "dark" | "outline" | "ghost" | "whatsapp" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-[background-color,color,border-color,box-shadow,opacity] duration-150 select-none disabled:opacity-50 disabled:pointer-events-none rounded-[var(--radius-control)] whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110 active:brightness-95 shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]",
  dark: "bg-ink text-paper hover:bg-ink/90",
  outline: "border border-line-strong bg-paper text-ink hover:border-ink",
  ghost: "text-ink hover:bg-canvas",
  whatsapp: "bg-[#127C45] text-white hover:bg-[#0F6A3B]",
  danger: "bg-danger text-white hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-14 px-7 text-base",
};

export function buttonClass(
  options: { variant?: ButtonVariant; size?: ButtonSize; full?: boolean; className?: string } = {},
): string {
  const { variant = "primary", size = "md", full = false, className = "" } = options;
  return [base, variants[variant], sizes[size], full ? "w-full" : "", className].filter(Boolean).join(" ");
}

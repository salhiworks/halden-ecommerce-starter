import type { ReactNode } from "react";

/**
 * The order summary as a receipt: amounts in a monospace face on dotted
 * leaders, and a torn edge at the bottom. Used at checkout and on the
 * confirmation page, so what a shopper agrees to and what they get back look
 * the same.
 */

export function Receipt({ title, children, footer }: { title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="drop-shadow-[0_1px_0_rgb(0_0_0/0.06)]">
      <div className="receipt-edge rounded-t-[var(--radius-card)] bg-canvas px-5 pb-8 pt-5 sm:px-6">
        <p className="eyebrow mb-4">{title}</p>
        {children}
        {footer}
      </div>
    </div>
  );
}

export function ReceiptLine({
  label,
  detail,
  amount,
  strong = false,
  muted = false,
}: {
  label: ReactNode;
  detail?: ReactNode;
  amount: ReactNode;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className={`py-1.5 ${strong ? "text-base font-semibold" : "text-sm"} ${muted ? "text-ink-3" : ""}`}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 shrink">{label}</span>
        <span className="mb-1 min-w-4 flex-1 border-b border-dotted border-line-strong" aria-hidden="true" />
        <span className="shrink-0 font-mono tabular-nums">{amount}</span>
      </div>
      {detail && <div className="mt-0.5 text-xs text-ink-3">{detail}</div>}
    </div>
  );
}

export function ReceiptRule() {
  return <div className="my-3 border-t border-dashed border-line-strong" aria-hidden="true" />;
}

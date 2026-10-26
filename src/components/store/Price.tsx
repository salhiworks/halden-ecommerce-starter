import { discountPercent, formatMoney, type MoneyFormat } from "@/lib/domain/money";

/**
 * A price, optionally with the "was" price struck through. The struck price
 * is only shown when it is a genuine discount.
 */
export function Price({
  amount,
  compareAt,
  money,
  from,
  wasLabel,
  className = "",
  size = "md",
}: {
  amount: number;
  compareAt?: number | null;
  money: MoneyFormat;
  /** Prefix such as "From $89" when variants differ. */
  from?: (price: string) => string;
  wasLabel?: (price: string) => string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const discounted = discountPercent(amount, compareAt) !== null;
  const now = formatMoney(amount, money);
  const sizes = { sm: "text-sm", md: "text-base", lg: "text-2xl sm:text-[1.75rem]" };
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span className={`price font-semibold ${sizes[size]} ${discounted ? "text-accent-text" : "text-ink"}`}>
        {from ? from(now) : now}
      </span>
      {discounted && compareAt != null && (
        <s className={`price relative text-ink-3 ${size === "lg" ? "text-base" : "text-sm"}`}>
          <span className="sr-only">{wasLabel ? wasLabel(formatMoney(compareAt, money)) : ""}</span>
          <span aria-hidden={wasLabel ? true : undefined}>{formatMoney(compareAt, money)}</span>
        </s>
      )}
    </span>
  );
}

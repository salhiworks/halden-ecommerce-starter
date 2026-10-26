import Image from "next/image";
import Link from "next/link";
import type { MoneyFormat } from "@/lib/domain/money";
import { imageAlt, isNewArrival, isSoldOut, primaryImage, priceSummary, secondaryImage } from "@/lib/domain/product";
import type { Product } from "@/lib/domain/types";
import type { Dictionary } from "@/lib/i18n";
import { Price } from "./Price";

/**
 * A product in a grid. Rendered on the server: the whole card is one link,
 * the second photo fades in on hover, and badges state only facts (a real
 * discount, sold out, recently added).
 */

export function ProductCard({
  product,
  money,
  t,
  priority = false,
}: {
  product: Product;
  money: MoneyFormat;
  t: Dictionary;
  priority?: boolean;
}) {
  const image = primaryImage(product);
  const hover = secondaryImage(product);
  const price = priceSummary(product);
  const soldOut = isSoldOut(product);
  const isNew = isNewArrival(product);
  const swatches = product.options
    .find((option) => option.values.some((value) => value.swatch))
    ?.values.filter((value) => value.swatch);

  return (
    <Link href={`/products/${product.slug}`} className="group flex flex-col gap-3 outline-none">
      <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-tile ring-accent/60 group-focus-visible:ring-2">
        {image ? (
          <>
            <Image
              src={image.url}
              alt={imageAlt(product, image)}
              fill
              priority={priority}
              sizes="(min-width: 1280px) 300px, (min-width: 768px) 30vw, 48vw"
              className={`object-cover transition-[opacity,transform] duration-500 ease-out ${
                hover ? "group-hover:opacity-0" : "group-hover:scale-[1.03]"
              } ${soldOut ? "opacity-70" : ""}`}
            />
            {hover && (
              <Image
                src={hover.url}
                alt=""
                fill
                sizes="(min-width: 1280px) 300px, (min-width: 768px) 30vw, 48vw"
                className="object-cover opacity-0 transition-opacity duration-500 ease-out group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-ink-3">{product.name}</div>
        )}
        <div className="absolute inset-x-2.5 top-2.5 flex flex-wrap gap-1.5">
          {soldOut ? (
            <span className="rounded-[var(--radius-pill)] bg-paper/95 px-2.5 py-1 text-[0.7rem] font-semibold text-ink">
              {t.product.soldOut}
            </span>
          ) : price.discount !== null ? (
            <span className="price rounded-[var(--radius-pill)] bg-accent px-2.5 py-1 text-[0.7rem] font-bold text-accent-ink">
              {t.product.save(price.discount)}
            </span>
          ) : isNew ? (
            <span className="rounded-[var(--radius-pill)] bg-paper/95 px-2.5 py-1 text-[0.7rem] font-semibold text-ink">
              {t.product.newBadge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-1 px-0.5">
        <h3 className="text-[0.95rem] font-medium leading-snug text-ink underline-offset-4 group-hover:underline">
          {product.name}
        </h3>
        <div className="flex items-center justify-between gap-3">
          <Price
            amount={price.min}
            compareAt={price.compareAt}
            money={money}
            from={price.varies ? t.product.from : undefined}
            wasLabel={t.product.wasPrice}
            size="sm"
          />
          {swatches && swatches.length > 1 && (
            <span className="flex shrink-0 -space-x-1 rtl:space-x-reverse" aria-hidden="true">
              {swatches.slice(0, 4).map((value) => (
                <span
                  key={value.label}
                  className="size-3.5 rounded-full border border-paper ring-1 ring-line-strong"
                  style={{ background: value.swatch ?? undefined }}
                />
              ))}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({
  products,
  money,
  t,
  priorityCount = 0,
  columns = "default",
}: {
  products: Product[];
  money: MoneyFormat;
  t: Dictionary;
  priorityCount?: number;
  columns?: "default" | "wide";
}) {
  return (
    <ul
      className={`grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-6 ${
        columns === "wide" ? "md:grid-cols-3 xl:grid-cols-4" : "md:grid-cols-3 lg:grid-cols-4"
      }`}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard product={product} money={money} t={t} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}

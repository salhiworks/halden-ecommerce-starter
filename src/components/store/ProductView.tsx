"use client";

import { Check, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { WhatsAppIcon } from "@/components/icons/brands";
import { buttonClass } from "@/components/ui/button";
import { addToCart, setCartDrawer } from "@/lib/cart/store";
import { MAX_LINE_QUANTITY } from "@/lib/domain/cart";
import { discountPercent } from "@/lib/domain/money";
import {
  defaultVariant,
  findVariant,
  imageAlt,
  isVariantInStock,
  lowStockCount,
  optionValueState,
  priceSummary,
  stockLimit,
  variantLabel,
} from "@/lib/domain/product";
import type { Product, ProductImage } from "@/lib/domain/types";
import { buildInquiryMessage, whatsappUrl } from "@/lib/domain/whatsapp";
import { useStore } from "./StoreProvider";

type Props = {
  product: Product;
  productUrl: string;
  category: { name: string; slug: string } | null;
  /** From a link to one variant (`?variant=…`, from the bag or shared). */
  variantId?: string | null;
  /** Server-rendered extras (description, details, delivery) under the buy box. */
  children?: ReactNode;
};

export function ProductView({ product, productUrl, category, variantId = null, children }: Props) {
  const { t, money, config } = useStore();

  // Colours (and options with a single value) start on the first buyable
  // variant; sizes, capacities and the like are left for the shopper to
  // choose, so nobody orders an XS by accident.
  const initial = useMemo(() => {
    const linked = variantId ? product.variants.find((candidate) => candidate.id === variantId) : null;
    if (linked) return product.options.map((_, index) => linked.optionValues[index] ?? null);
    const variant = defaultVariant(product);
    return product.options.map((option, index) =>
      option.values.length === 1 || option.values.some((value) => value.swatch)
        ? (variant?.optionValues[index] ?? null)
        : null,
    );
  }, [product, variantId]);

  const [selection, setSelection] = useState<(string | null)[]>(initial);
  const [chosenQuantity, setQuantity] = useState(1);
  const [missing, setMissing] = useState<number | null>(null);
  const [added, setAdded] = useState(false);

  const complete = selection.every((value) => value !== null);
  const variant = complete ? findVariant(product, selection) : null;
  const limit = variant ? stockLimit(product, variant) : null;
  const inStock = variant ? isVariantInStock(product, variant) : true;
  const low = variant ? lowStockCount(product, variant) : null;
  const summary = priceSummary(product);
  const price = variant?.price ?? summary.min;
  const compareAt = variant ? variant.compareAtPrice : summary.compareAt;
  const discount = discountPercent(price, compareAt);
  const maxQuantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, limit ?? MAX_LINE_QUANTITY));
  // Never more than the chosen variant has in stock.
  const quantity = Math.min(chosenQuantity, maxQuantity);

  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), 2400);
    return () => clearTimeout(timer);
  }, [added]);

  const choose = (index: number, value: string) => {
    setSelection((current) => current.map((entry, position) => (position === index ? value : entry)));
    setMissing(null);
  };

  const add = () => {
    const firstMissing = selection.findIndex((value) => value === null);
    if (firstMissing >= 0 || !variant) {
      setMissing(firstMissing >= 0 ? firstMissing : 0);
      return;
    }
    if (!inStock) return;
    addToCart({ productId: product.id, variantId: variant.id, quantity });
    setAdded(true);
    setCartDrawer(true);
  };

  const inquiry = config.whatsapp.configured
    ? whatsappUrl(
        config.whatsapp.number,
        buildInquiryMessage(
          { name: product.name, variantLabel: variant ? variantLabel(variant) : "", url: productUrl },
          { storeName: config.storeName, labels: t.whatsapp },
        ),
      )
    : null;

  const activeImageId = variant?.imageId ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
      <Gallery product={product} activeImageId={activeImageId} />

      <div className="lg:sticky lg:top-24 lg:self-start">
        {category && (
          <Link href={`/categories/${category.slug}`} className="eyebrow hover:text-ink">
            {category.name}
          </Link>
        )}
        <h1 className="display mt-3 text-[clamp(1.75rem,3.2vw,2.6rem)]">{product.name}</h1>
        {product.summary && <p className="mt-3 text-ink-2">{product.summary}</p>}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className={`price text-[1.75rem] font-semibold ${discount ? "text-accent-text" : ""}`}>
            {!variant && summary.varies ? t.product.from(money(price)) : money(price)}
          </span>
          {discount !== null && compareAt != null && (
            <>
              <s className="price relative text-lg text-ink-3">
                <span className="sr-only">{t.product.wasPrice(money(compareAt))}</span>
                <span aria-hidden="true">{money(compareAt)}</span>
              </s>
              <span className="price rounded-[var(--radius-pill)] bg-accent px-2.5 py-1 text-xs font-bold text-accent-ink">
                {t.product.save(discount)}
              </span>
            </>
          )}
        </div>

        {product.options.length > 0 && (
          <div className="mt-8 space-y-6">
            {product.options.map((option, index) => {
              const swatches = option.values.some((value) => value.swatch);
              const chosen = selection[index];
              return (
                <fieldset key={option.name}>
                  <legend className="mb-3 flex w-full items-baseline justify-between text-sm">
                    <span>
                      <span className="font-semibold">{option.name}</span>
                      {chosen && <span className="text-ink-2">: {chosen}</span>}
                    </span>
                    {missing === index && (
                      <span className="font-medium text-danger" role="alert">
                        {t.product.choose(option.name)}
                      </span>
                    )}
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {option.values.map((value) => {
                      const state = optionValueState(product, index, value.label, selection);
                      const selected = chosen === value.label;
                      const soldOut = state !== "available";
                      if (swatches && value.swatch) {
                        return (
                          <button
                            key={value.label}
                            type="button"
                            onClick={() => choose(index, value.label)}
                            aria-pressed={selected}
                            aria-label={`${value.label}${soldOut ? ` — ${t.product.soldOut}` : ""}`}
                            title={value.label}
                            className={`relative grid size-11 place-items-center rounded-full border-2 transition-colors ${
                              selected ? "border-ink" : "border-transparent hover:border-line-strong"
                            }`}
                          >
                            <span
                              className="size-8 rounded-full ring-1 ring-black/10"
                              style={{ background: value.swatch }}
                            />
                            {soldOut && (
                              <span
                                className="pointer-events-none absolute h-0.5 w-9 -rotate-45 rounded bg-paper ring-1 ring-ink/30"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={value.label}
                          type="button"
                          onClick={() => choose(index, value.label)}
                          aria-pressed={selected}
                          aria-label={`${value.label}${soldOut ? ` — ${t.product.soldOut}` : ""}`}
                          className={`min-w-12 rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-medium transition-colors ${
                            selected
                              ? "border-ink bg-ink text-paper"
                              : soldOut
                                ? "border-line text-ink-3 line-through decoration-ink-3/70"
                                : "border-line-strong hover:border-ink"
                          }`}
                        >
                          {value.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}

        <p className="mt-6 flex items-center gap-2 text-sm" aria-live="polite">
          <span
            className={`size-2 rounded-full ${!inStock ? "bg-danger" : low ? "bg-warning" : "bg-success"}`}
            aria-hidden="true"
          />
          {!complete
            ? t.product.inStock
            : !inStock
              ? t.product.soldOut
              : low
                ? t.product.onlyLeft(low)
                : t.product.inStock}
        </p>

        <div className="mt-4 flex gap-3">
          <div className="flex h-14 items-center rounded-[var(--radius-control)] border border-line-strong">
            <button
              type="button"
              className="grid h-full w-11 place-items-center text-ink-2 hover:text-ink disabled:opacity-30"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              aria-label={t.product.decrease}
            >
              <Minus size={16} />
            </button>
            <span className="price w-8 text-center" aria-label={t.product.quantity}>
              {quantity}
            </span>
            <button
              type="button"
              className="grid h-full w-11 place-items-center text-ink-2 hover:text-ink disabled:opacity-30"
              onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
              disabled={quantity >= maxQuantity}
              aria-label={t.product.increase}
            >
              <Plus size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={add}
            disabled={complete && !inStock}
            className={buttonClass({ size: "lg", className: "flex-1" })}
            data-testid="add-to-cart"
          >
            {added ? (
              <>
                <Check size={18} />
                {t.product.added}
              </>
            ) : complete && !inStock ? (
              t.product.soldOut
            ) : (
              t.product.addToCart
            )}
          </button>
        </div>

        {inquiry && (
          <a
            href={inquiry}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass({ variant: "outline", full: true, className: "mt-3" })}
          >
            <WhatsAppIcon size={18} />
            {t.product.askOnWhatsApp}
          </a>
        )}

        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- gallery */

/**
 * The photo frame takes the shape of the product's first photo (extreme ones
 * within 1:2 to 2:1), and is never taller than
 * `--gallery-max`: on phones and tablets about a screen's width or 60% of its
 * height, on desktop what fits below the header. Photos are shown whole
 * (`object-contain`), so a photo of another shape sits on the tile colour
 * instead of being cropped.
 */
const FRAME =
  "relative mx-auto aspect-[var(--ratio)] w-[min(100%,calc(var(--gallery-max)*var(--ratio)))] overflow-hidden rounded-card bg-tile";

function frameRatio(image: ProductImage | undefined): number {
  if (!image?.width || !image.height) return 4 / 5;
  return Math.min(2, Math.max(1 / 2, image.width / image.height));
}

function Gallery({ product, activeImageId }: { product: Product; activeImageId: string | null }) {
  const { t } = useStore();
  const images = product.images;
  const frame = {
    className: "[--gallery-max:min(100vw,60svh)] lg:[--gallery-max:max(26rem,calc(100svh-12rem))]",
    style: { "--ratio": frameRatio(images[0]) } as CSSProperties,
  };
  const [index, setIndex] = useState(() => Math.max(0, images.findIndex((image) => image.id === activeImageId)));
  const rail = useRef<HTMLDivElement>(null);

  // Selecting a colour with its own photo brings that photo forward…
  const [shownFor, setShownFor] = useState(activeImageId);
  if (activeImageId !== shownFor) {
    setShownFor(activeImageId);
    const target = images.findIndex((image) => image.id === activeImageId);
    if (target >= 0) setIndex(target);
  }

  // …and on phones, scrolls the swipe rail to it.
  useEffect(() => {
    const target = images.findIndex((image) => image.id === activeImageId);
    const element = rail.current?.children[target] as HTMLElement | undefined;
    if (target >= 0 && element && rail.current) {
      rail.current.scrollTo({ left: element.offsetLeft - rail.current.offsetLeft, behavior: "smooth" });
    }
  }, [activeImageId, images]);

  // With many photos the thumbnails scroll; keep the current one in view.
  const thumbs = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = thumbs.current;
    const item = list?.children[index];
    if (!list || !item) return;
    const outer = list.getBoundingClientRect();
    const inner = item.getBoundingClientRect();
    if (inner.left < outer.left) list.scrollBy({ left: inner.left - outer.left, behavior: "smooth" });
    else if (inner.right > outer.right) list.scrollBy({ left: inner.right - outer.right, behavior: "smooth" });
  }, [index]);

  if (images.length === 0) {
    return (
      <div {...frame}>
        <div className={FRAME} />
      </div>
    );
  }

  return (
    <div {...frame}>
      {/* Phones: swipe between photos. */}
      <div className="relative -mx-4 sm:mx-0 lg:hidden">
        <div
          ref={rail}
          className="scrollbar-none relative flex snap-x snap-mandatory overflow-x-auto"
          onScroll={(event) => {
            const element = event.currentTarget;
            // In right-to-left languages scrollLeft counts down from 0.
            const next = Math.round(Math.abs(element.scrollLeft) / element.clientWidth);
            if (next !== index) setIndex(next);
          }}
        >
          {images.map((image, position) => (
            <div key={image.id} className="w-full shrink-0 snap-center px-4 sm:px-0">
              <div className={FRAME}>
                <Image
                  src={image.url}
                  alt={imageAlt(product, image, position)}
                  fill
                  priority={position === 0}
                  sizes="100vw"
                  className="object-contain"
                />
              </div>
            </div>
          ))}
        </div>
        {images.length > 1 && (
          <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
            {images.map((image, position) => (
              <span
                key={image.id}
                className={`h-1.5 rounded-full transition-all ${position === index ? "w-5 bg-ink" : "w-1.5 bg-line-strong"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: a large photo with hover zoom, and thumbnails. */}
      <div className="hidden lg:block">
        <ZoomImage image={images[index]} alt={imageAlt(product, images[index], index)} />
        {images.length > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIndex((current) => (current - 1 + images.length) % images.length)}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line hover:border-ink"
              aria-label={t.product.previousPhoto}
            >
              <ChevronLeft size={18} className="flip-rtl" />
            </button>
            <ul ref={thumbs} className="scrollbar-none flex min-w-0 gap-3 overflow-x-auto p-1">
              {images.map((image, position) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-label={t.product.photo(position + 1, images.length)}
                    aria-current={position === index}
                    className={`relative block h-24 w-20 overflow-hidden rounded-[calc(var(--radius-card)*0.6)] bg-tile ring-offset-2 transition ${
                      position === index ? "ring-2 ring-ink" : "opacity-75 hover:opacity-100"
                    }`}
                  >
                    <Image src={image.url} alt="" fill sizes="80px" className="object-cover" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setIndex((current) => (current + 1) % images.length)}
              className="grid size-10 shrink-0 place-items-center rounded-full border border-line hover:border-ink"
              aria-label={t.product.nextPhoto}
            >
              <ChevronRight size={18} className="flip-rtl" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Follows the pointer at 2× so the texture of a product can be seen. */
function ZoomImage({ image, alt }: { image: ProductImage; alt: string }) {
  const [origin, setOrigin] = useState<string | null>(null);
  return (
    <div
      className={`${FRAME} cursor-zoom-in`}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse") return;
        const box = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width) * 100;
        const y = ((event.clientY - box.top) / box.height) * 100;
        setOrigin(`${x}% ${y}%`);
      }}
      onPointerLeave={() => setOrigin(null)}
    >
      <Image
        key={image.id}
        src={image.url}
        alt={alt}
        fill
        priority
        sizes="(min-width: 1440px) 760px, 55vw"
        className="object-contain transition-transform duration-200 ease-out"
        style={{ transform: origin ? "scale(2)" : "scale(1)", transformOrigin: origin ?? "50% 50%" }}
      />
    </div>
  );
}

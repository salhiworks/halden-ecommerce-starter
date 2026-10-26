"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type DirectoryEntry = {
  href: string;
  name: string;
  countLabel: string;
  imageUrl: string | null;
};

/**
 * The store directory: departments listed like the board by a shop's
 * entrance, in large signage type with a live item count. On wide screens
 * the photo of whichever department is under the pointer fills the panel
 * beside the list; on phones each row carries its own thumbnail.
 */
export function Directory({ entries }: { entries: DirectoryEntry[] }) {
  const [active, setActive] = useState(0);
  const withImages = entries.some((entry) => entry.imageUrl);

  return (
    // grid-cols-1 caps the list at the screen width; without it, the column
    // grows to fit the longest department name on one line.
    <div className={`grid grid-cols-1 gap-10 ${withImages ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]" : ""}`}>
      <ul className="border-t border-ink" onMouseLeave={() => setActive((current) => current)}>
        {entries.map((entry, index) => (
          <li key={entry.href}>
            <Link
              href={entry.href}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              className="group flex items-center gap-3 border-b border-line py-4 min-[400px]:gap-4 sm:gap-6 sm:py-5 lg:py-6"
            >
              {entry.imageUrl && (
                <span className="relative size-12 shrink-0 overflow-hidden rounded-[calc(var(--radius-card)*0.6)] bg-tile min-[400px]:size-16 sm:size-20 lg:hidden">
                  <Image src={entry.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                </span>
              )}
              {/* Sized so the longest word of a usual department name fits a small phone; a longer one wraps rather than overflowing. */}
              <span className="display min-w-0 flex-1 text-[clamp(1.1rem,5.4vw,1.6rem)] transition-colors duration-200 [overflow-wrap:anywhere] group-hover:text-accent-text sm:text-[clamp(1.6rem,4.6vw,3.4rem)]">
                {entry.name}
              </span>
              <span className="price hidden shrink-0 text-sm text-ink-3 sm:block">{entry.countLabel}</span>
              <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong min-[400px]:size-10 transition-[background-color,border-color,color] duration-200 group-hover:border-accent group-hover:bg-accent group-hover:text-accent-ink">
                <ArrowRight size={18} className="flip-rtl" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {withImages && (
        <div className="relative hidden aspect-[4/5] overflow-hidden rounded-card bg-tile lg:sticky lg:top-24 lg:block lg:self-start">
          {entries.map((entry, index) =>
            entry.imageUrl ? (
              <Image
                key={entry.href}
                src={entry.imageUrl}
                alt=""
                fill
                sizes="28rem"
                className={`object-cover transition-opacity duration-500 ${index === active ? "opacity-100" : "opacity-0"}`}
              />
            ) : null,
          )}
          <span className="display absolute bottom-4 start-4 rounded-[var(--radius-pill)] bg-paper/90 px-3.5 py-2 text-xs">
            {entries[active]?.name}
          </span>
        </div>
      )}
    </div>
  );
}

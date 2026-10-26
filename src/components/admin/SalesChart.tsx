"use client";

import { useState } from "react";
import { formatMoney, type MoneyFormat } from "@/lib/domain/money";

/**
 * Confirmed sales per day for the last 30 days — a single series, so the
 * title names it and there is no legend. Bars are anchored to the baseline
 * with rounded data-ends; every day has a full-height hover target and the
 * same numbers are available as a table for screen readers.
 */
export function SalesChart({
  daily,
  money,
}: {
  daily: { date: string; total: number; count: number }[];
  money: MoneyFormat;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 600;
  const height = 140;
  const gap = 2;
  const max = Math.max(...daily.map((day) => day.total), 0);
  const bar = width / daily.length;
  const label = (date: string) =>
    new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

  const path = (x: number, w: number, h: number) => {
    const r = Math.min(4, w / 2, h);
    const y = height - h;
    return `M${x},${height} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${height} Z`;
  };

  const active = hover === null ? null : daily[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height + 1}`}
        className="h-36 w-full overflow-visible"
        role="img"
        aria-label="Confirmed sales per day, last 30 days"
        preserveAspectRatio="none"
        onPointerLeave={() => setHover(null)}
      >
        <line x1={0} x2={width} y1={height + 0.5} y2={height + 0.5} stroke="var(--line-strong)" strokeWidth={1} />
        {daily.map((day, index) => {
          const h = max > 0 ? Math.max(day.total > 0 ? 3 : 0, (day.total / max) * (height - 8)) : 0;
          const x = index * bar + gap / 2;
          const w = Math.max(1, bar - gap);
          return (
            <g key={day.date}>
              {h > 0 && (
                <path
                  d={path(x, w, h)}
                  fill="var(--accent-text)"
                  opacity={hover === null || hover === index ? 1 : 0.45}
                />
              )}
              <rect
                x={index * bar}
                y={0}
                width={bar}
                height={height}
                fill="transparent"
                onPointerEnter={() => setHover(index)}
                onFocus={() => setHover(index)}
              />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex justify-between text-xs text-ink-3" aria-hidden="true">
        <span>{label(daily[0]?.date ?? "")}</span>
        <span>{label(daily.at(-1)?.date ?? "")}</span>
      </div>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-[8px] bg-ink px-2.5 py-1.5 text-xs text-paper shadow-lg"
          style={{ left: `${((hover + 0.5) / daily.length) * 100}%` }}
        >
          <p className="font-medium">{label(active.date)}</p>
          <p className="font-mono">
            {formatMoney(active.total, money, "full")} · {active.count} {active.count === 1 ? "order" : "orders"}
          </p>
        </div>
      )}
      <table className="sr-only">
        <caption>Confirmed sales per day</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Sales</th>
            <th scope="col">Orders</th>
          </tr>
        </thead>
        <tbody>
          {daily.map((day) => (
            <tr key={day.date}>
              <td>{label(day.date)}</td>
              <td>{formatMoney(day.total, money, "full")}</td>
              <td>{day.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

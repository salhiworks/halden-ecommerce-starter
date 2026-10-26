"use client";

import { useSyncExternalStore } from "react";
import { clampQuantity, lineKey, MAX_CART_LINES, parseCartLines, type CartLine } from "@/lib/domain/cart";

/**
 * ===========================================================================
 *  THE BAG (client side)
 * ===========================================================================
 *
 *  The bag lives in localStorage and holds only ids and quantities — never a
 *  price. Components read it through `useSyncExternalStore`, so the server
 *  renders an empty bag and the browser fills it in without a hydration
 *  mismatch. Every displayed number comes from a server quote (see
 *  `useCartQuote`).
 *
 *  Changes made in another tab arrive through the `storage` event, so two
 *  open tabs never disagree about what is in the bag.
 */

const STORAGE_KEY = "storefront.bag.v1";

type Snapshot = { lines: CartLine[]; hydrated: boolean };

const SERVER_SNAPSHOT: Snapshot = { lines: [], hydrated: false };

let snapshot: Snapshot = SERVER_SNAPSHOT;
let started = false;
const listeners = new Set<() => void>();

function emit(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function readStorage(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? parseCartLines(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

function writeStorage(lines: CartLine[]) {
  try {
    if (lines.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode or a full disk: the bag still works for this visit.
  }
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  emit({ lines: readStorage(), hydrated: true });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null) emit({ lines: readStorage(), hydrated: true });
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => listeners.delete(listener);
}

function update(change: (lines: CartLine[]) => CartLine[]) {
  start();
  const lines = change(snapshot.lines).slice(0, MAX_CART_LINES);
  writeStorage(lines);
  emit({ lines, hydrated: true });
}

export function useCartLines(): Snapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER_SNAPSHOT);
}

export function addToCart(line: CartLine) {
  update((lines) => {
    const key = lineKey(line);
    const existing = lines.find((candidate) => lineKey(candidate) === key);
    if (!existing) return [...lines, { ...line, quantity: clampQuantity(line.quantity) }];
    return lines.map((candidate) =>
      lineKey(candidate) === key
        ? { ...candidate, quantity: clampQuantity(candidate.quantity + line.quantity) }
        : candidate,
    );
  });
}

export function setLineQuantity(key: string, quantity: number) {
  update((lines) =>
    lines.map((line) => (lineKey(line) === key ? { ...line, quantity: clampQuantity(quantity) } : line)),
  );
}

export function removeLine(key: string) {
  update((lines) => lines.filter((line) => lineKey(line) !== key));
}

export function clearCart() {
  update(() => []);
}

/* -------------------------------------------------------- drawer state */

let drawerOpen = false;
const drawerListeners = new Set<() => void>();

export function setCartDrawer(open: boolean) {
  drawerOpen = open;
  for (const listener of drawerListeners) listener();
}

export function useCartDrawer(): boolean {
  return useSyncExternalStore(
    (listener) => {
      drawerListeners.add(listener);
      return () => drawerListeners.delete(listener);
    },
    () => drawerOpen,
    () => false,
  );
}

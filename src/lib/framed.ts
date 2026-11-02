"use client";

import { useSyncExternalStore } from "react";

/**
 * True when this page is shown inside another page's frame — in practice, the
 * public demo inside the Profit Studio Live Demo showcase (next.config.mjs is
 * the only thing that lets another site frame the store, and only in public demo
 * mode). Some steps cannot complete in a frame — the browser keeps a framed
 * page's cookies apart — so they open in a new tab instead. False on the server
 * and on the first render, so nothing differs in the server HTML.
 */
function framed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // reading window.top across origins can throw: that is a frame too
  }
}

export function useFramed(): boolean {
  return useSyncExternalStore(
    () => () => {},
    framed,
    () => false,
  );
}

"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether the dashboard is the public demo's read-only preview. Editors use
 * it to skip "unsaved changes" warnings, since nothing can be saved there.
 */
const PreviewContext = createContext(false);

export function PreviewProvider({ preview, children }: { preview: boolean; children: ReactNode }) {
  return <PreviewContext.Provider value={preview}>{children}</PreviewContext.Provider>;
}

export function usePreview(): boolean {
  return useContext(PreviewContext);
}

"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * A side panel built on the native <dialog> element, which already traps
 * focus, closes on Escape and returns focus to whatever opened it. It slides
 * in from the inline end — the right in English, the left in Arabic.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "end",
  closeLabel,
  footer,
  children,
  widthClass = "w-[min(100vw,26rem)]",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: "start" | "end";
  closeLabel: string;
  footer?: ReactNode;
  children: ReactNode;
  widthClass?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={() => {
        document.documentElement.style.overflow = "";
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className={`fixed inset-y-0 m-0 h-dvh max-h-dvh max-w-none bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 open:flex ${widthClass} ${
        side === "end" ? "ms-auto me-0 drawer-end" : "ms-0 me-auto drawer-start"
      }`}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="-me-2 grid size-10 place-items-center rounded-full hover:bg-canvas"
            aria-label={closeLabel}
          >
            <X size={20} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className="shrink-0 border-t border-line bg-paper p-5">{footer}</div>}
      </div>
    </dialog>
  );
}

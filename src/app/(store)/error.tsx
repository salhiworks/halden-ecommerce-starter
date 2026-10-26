"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/ui/button";
import { useStore } from "@/components/store/StoreProvider";

export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useStore();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="display text-[clamp(1.8rem,4vw,2.6rem)]">{t.error.title}</h1>
      <p className="mt-4 text-ink-2">{t.error.text}</p>
      <button type="button" onClick={reset} className={buttonClass({ variant: "dark", className: "mt-8" })}>
        {t.common.retry}
      </button>
    </div>
  );
}

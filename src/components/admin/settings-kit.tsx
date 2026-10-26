"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/button";
import type { StoreSettings } from "@/lib/domain/settings";
import { saveSettingsAction } from "@/server/actions/admin";
import { usePreview } from "./preview";
import { useToast } from "./ui";

/**
 * Settings are one document, edited in independent panels: each panel keeps
 * its own draft and saves only its own part, so an unsaved edit in one panel
 * survives saving another.
 */

type Section = Parameters<typeof saveSettingsAction>[0];

const SettingsContext = createContext<{
  settings: StoreSettings;
  setSettings: (settings: StoreSettings) => void;
} | null>(null);

export function SettingsProvider({ initial, children }: { initial: StoreSettings; children: ReactNode }) {
  const [settings, setSettings] = useState(initial);
  // Follow the server when settings changed elsewhere (loading the demo store).
  const initialKey = JSON.stringify(initial);
  const [lastKey, setLastKey] = useState(initialKey);
  if (initialKey !== lastKey) {
    setLastKey(initialKey);
    setSettings(initial);
  }
  return <SettingsContext.Provider value={{ settings, setSettings }}>{children}</SettingsContext.Provider>;
}

export function useStoredSettings(): StoreSettings {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useStoredSettings needs a SettingsProvider");
  return context.settings;
}

export function useSettingsDraft<D>({
  read,
  write,
  validate,
  saved: savedMessage,
}: {
  /** The panel's draft, from the stored settings. */
  read: (settings: StoreSettings) => D;
  /** What to save: a section and its complete new value. */
  write: (draft: D, settings: StoreSettings) => { section: Section; value: unknown };
  /** Checks the server cannot phrase well (a blank amount, say). */
  validate?: (draft: D) => Record<string, string | undefined>;
  saved: string;
}) {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettingsDraft needs a SettingsProvider");
  const router = useRouter();
  const toast = useToast();
  const preview = usePreview();

  const stored = read(context.settings);
  const storedKey = JSON.stringify(stored);
  const [draft, setDraft] = useState(stored);
  const [baseKey, setBaseKey] = useState(storedKey);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // This panel's part was saved (here or by a refresh): start from it.
  if (storedKey !== baseKey) {
    setBaseKey(storedKey);
    setDraft(stored);
  }

  const dirty = JSON.stringify(draft) !== storedKey;

  useEffect(() => {
    if (!dirty || preview) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, preview]);

  const save = async () => {
    const problems = Object.fromEntries(
      Object.entries(validate?.(draft) ?? {}).filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      toast("danger", "Some fields need attention.");
      return false;
    }
    setBusy(true);
    const { section, value } = write(draft, context.settings);
    const result = await saveSettingsAction(section, value);
    setBusy(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      toast("danger", result.error);
      return false;
    }
    setErrors({});
    context.setSettings(result.data);
    toast("success", savedMessage);
    router.refresh();
    return true;
  };

  return {
    draft,
    setDraft,
    patch: (changes: Partial<D>) => setDraft((current) => ({ ...current, ...changes })),
    errors,
    busy,
    dirty,
    save,
    reset: () => {
      setDraft(stored);
      setErrors({});
    },
  };
}

/** A settings panel as a form: Save is enabled once something changed. */
export function SettingsPanel({
  id,
  title,
  description,
  dirty,
  busy,
  onSave,
  onReset,
  children,
  saveLabel = "Save",
  testId,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  dirty: boolean;
  busy: boolean;
  onSave: () => Promise<unknown>;
  onReset: () => void;
  children: ReactNode;
  saveLabel?: string;
  testId?: string;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (dirty && !busy) void onSave();
  };
  return (
    <form id={id} onSubmit={submit} className="scroll-mt-24 rounded-[14px] border border-line bg-paper" data-testid={testId} noValidate>
      <div className="border-b border-line px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
      <div className="flex items-center justify-end gap-3 border-t border-line px-5 py-3">
        {dirty && (
          <>
            <span className="me-auto text-xs font-medium text-warning">Unsaved changes</span>
            <button type="button" onClick={onReset} disabled={busy} className={buttonClass({ variant: "ghost", size: "sm" })}>
              Undo
            </button>
          </>
        )}
        <button type="submit" disabled={!dirty || busy} className={buttonClass({ size: "sm" })}>
          {busy ? "Saving…" : saveLabel}
        </button>
      </div>
    </form>
  );
}

/** Errors for one part of a section: `errorsUnder(errors, "hero")["heading"]`. */
export function errorsUnder(errors: Record<string, string>, prefix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(errors)) {
    if (key.startsWith(`${prefix}.`)) out[key.slice(prefix.length + 1)] = message;
  }
  return out;
}

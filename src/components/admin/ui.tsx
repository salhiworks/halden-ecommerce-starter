"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { buttonClass, type ButtonVariant } from "@/components/ui/button";

/* ------------------------------------------------------------- structure */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && <div className="mb-3">{back}</div>}
        <h1 className="display text-[clamp(1.6rem,3vw,2.2rem)]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  padded = true,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-[14px] border border-line bg-paper ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- fields */

function useFieldId(explicit?: string) {
  const generated = useId();
  return explicit ?? generated;
}

const controlClass = (invalid: boolean) =>
  `w-full rounded-[10px] border bg-paper px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-3 focus:border-ink disabled:bg-canvas disabled:text-ink-3 ${
    invalid ? "border-danger" : "border-line-strong"
  }`;

type FieldShell = { label: ReactNode; hint?: ReactNode; error?: string; className?: string; optional?: boolean };

function Shell({ id, label, hint, error, className = "", optional, children }: FieldShell & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-medium">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-ink-3">Optional</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  className,
  optional,
  prefix,
  suffix,
  id,
  ...input
}: FieldShell & InputHTMLAttributes<HTMLInputElement> & { prefix?: ReactNode; suffix?: ReactNode }) {
  const fieldId = useFieldId(id);
  const control = (
    <input
      id={fieldId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
      {...input}
      className={`${controlClass(Boolean(error))} ${prefix ? "ps-9" : ""} ${suffix ? "pe-12" : ""}`}
    />
  );
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      {prefix || suffix ? (
        <div className="relative">
          {prefix && <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-sm text-ink-3">{prefix}</span>}
          {control}
          {suffix && <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs text-ink-3">{suffix}</span>}
        </div>
      ) : (
        control
      )}
    </Shell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  optional,
  id,
  ...textarea
}: FieldShell & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = useFieldId(id);
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...textarea}
        className={`${controlClass(Boolean(error))} min-h-24 leading-relaxed`}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  optional,
  id,
  children,
  ...select
}: FieldShell & SelectHTMLAttributes<HTMLSelectElement>) {
  const fieldId = useFieldId(id);
  return (
    <Shell id={fieldId} label={label} hint={hint} error={error} className={className} optional={optional}>
      <select
        id={fieldId}
        aria-invalid={error ? true : undefined}
        {...select}
        className={`${controlClass(Boolean(error))} pe-8`}
      >
        {children}
      </select>
    </Shell>
  );
}

/** An on/off switch with a label and a one-line explanation. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useFieldId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? "bg-accent" : "bg-line-strong"
        }`}
      >
        <span
          className={`inline-block size-5 rounded-full bg-paper shadow transition-transform ${
            checked ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0.5 rtl:-translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ pills */

export type Tone = "neutral" | "info" | "warning" | "success" | "danger" | "muted" | "accent";

const toneClass: Record<Tone, string> = {
  neutral: "bg-canvas text-ink",
  info: "bg-info-soft text-info",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  muted: "bg-canvas text-ink-3",
  accent: "bg-accent-soft text-accent-text",
};

export function Pill({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === "success" ? CircleCheck : tone === "info" ? Info : CircleAlert;
  return (
    <div className={`flex gap-3 rounded-[12px] px-4 py-3 text-sm ${toneClass[tone]}`} role={tone === "danger" ? "alert" : undefined}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <span className="mb-4 grid size-12 place-items-center rounded-full bg-canvas text-ink-2">{icon}</span>}
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------- dialogs */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      // React lets `close` bubble, so a confirm dialog opened from inside this
      // one would close both. Only react to our own.
      onClose={(event) => event.target === event.currentTarget && onClose()}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className={`m-auto max-h-[90dvh] w-[calc(100vw-2rem)] rounded-[16px] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40 open:flex ${
        size === "lg" ? "max-w-3xl" : "max-w-lg"
      }`}
    >
      <div className="flex max-h-[90dvh] w-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-canvas" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}

/** A button that asks before doing something that cannot be undone. */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "outline",
  confirmVariant = "danger",
  size = "md",
  disabled,
  className,
}: {
  children: ReactNode;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
  variant?: ButtonVariant;
  confirmVariant?: ButtonVariant;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={buttonClass({ variant, size, className })}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={title}
        footer={
          <>
            <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass({ variant: confirmVariant })}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                } finally {
                  setBusy(false);
                  setOpen(false);
                }
              }}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-ink-2">{description}</div>
      </Modal>
    </>
  );
}

/* ----------------------------------------------------------------- toasts */

type Toast = { id: number; tone: "success" | "danger" | "info"; text: string };
const ToastContext = createContext<(tone: Toast["tone"], text: string) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, tone, text }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), tone === "danger" ? 7000 : 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium shadow-lg ${
              toast.tone === "danger" ? "bg-danger text-white" : "bg-ink text-paper"
            }`}
            role={toast.tone === "danger" ? "alert" : "status"}
          >
            {toast.tone === "success" ? <CircleCheck size={16} /> : toast.tone === "danger" ? <CircleAlert size={16} /> : <Info size={16} />}
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

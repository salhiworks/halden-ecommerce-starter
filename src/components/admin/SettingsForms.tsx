"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { COMMON_CURRENCIES } from "@/lib/domain/money";
import { formatInternational, isValidWhatsAppNumber, normalizePhone } from "@/lib/domain/phone";
import { LANGUAGE_LABELS, LANGUAGES, type Language } from "@/lib/i18n/languages";
import { uid } from "@/lib/uid";
import { changePasswordAction, loadDemoAction, removeDemoAction } from "@/server/actions/admin";
import { ImagePicker } from "./ImagePicker";
import { SettingsPanel, useSettingsDraft, useStoredSettings } from "./settings-kit";
import { ConfirmButton, Notice, Panel, SelectField, TextAreaField, TextField, Toggle, useToast } from "./ui";

/* ------------------------------------------------------------------ store */

function currencyName(code: string): string {
  try {
    return new Intl.DisplayNames("en", { type: "currency" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function StorePanel() {
  const stored = useStoredSettings();
  const form = useSettingsDraft({
    read: (settings) => settings.store,
    write: (draft) => ({ section: "store", value: draft }),
    saved: "Store details saved",
  });
  const { draft, patch, errors } = form;
  const listed = (COMMON_CURRENCIES as readonly string[]).includes(draft.currency);
  const [otherCurrency, setOtherCurrency] = useState(!listed);

  return (
    <SettingsPanel
      id="store"
      title="Store"
      description="Your shop's name and the language and currency it sells in."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="settings-store"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          label="Store name"
          value={draft.name}
          maxLength={60}
          error={errors.name}
          onChange={(event) => patch({ name: event.target.value })}
          required
        />
        <TextField
          label="Tagline"
          optional
          value={draft.tagline}
          maxLength={120}
          error={errors.tagline}
          onChange={(event) => patch({ tagline: event.target.value })}
          hint="A short line under your name in the footer and in search results."
        />
        <TextAreaField
          label="About the store"
          optional
          className="md:col-span-2"
          rows={3}
          maxLength={500}
          value={draft.description}
          onChange={(event) => patch({ description: event.target.value })}
          hint="Two or three sentences. Search engines and link previews show it."
        />
        <ImagePicker
          label="Logo"
          value={draft.logoUrl}
          onChange={(url) => patch({ logoUrl: url })}
          aspect="aspect-[3/1]"
          fit="contain"
          hint="Replaces the name in the header. A wide PNG with a transparent background works best."
        />
        <div className="space-y-5">
          <SelectField
            label="Shop language"
            value={draft.language}
            onChange={(event) => patch({ language: event.target.value as Language })}
            hint="The language of buttons, labels and messages in your shop. Arabic also switches it to right-to-left. Product texts are whatever you type."
          >
            {LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {LANGUAGE_LABELS[language]}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Currency"
            value={otherCurrency ? "other" : draft.currency}
            error={otherCurrency ? undefined : errors.currency}
            onChange={(event) => {
              if (event.target.value === "other") setOtherCurrency(true);
              else {
                setOtherCurrency(false);
                patch({ currency: event.target.value });
              }
            }}
          >
            {COMMON_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code} — {currencyName(code)}
              </option>
            ))}
            <option value="other">Another currency…</option>
          </SelectField>
          {otherCurrency && (
            <TextField
              label="Currency code"
              value={draft.currency}
              maxLength={3}
              error={errors.currency}
              onChange={(event) => patch({ currency: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
              hint="The three-letter ISO code, like NZD or QAR."
            />
          )}
          {draft.currency !== stored.store.currency && (
            <Notice tone="warning">
              Prices are not converted: a product at 25 stays at 25, now in {draft.currency || "the new currency"}.
            </Notice>
          )}
        </div>
        <TextField
          label="Shop address"
          optional
          className="md:col-span-2"
          type="url"
          inputMode="url"
          placeholder="https://shop.example.com"
          value={draft.siteUrl}
          error={errors.siteUrl}
          onChange={(event) => patch({ siteUrl: event.target.value })}
          hint="The public address of your shop, used in shared links and the sitemap. Leave it blank to use the address the shop is opened at."
        />
      </div>
    </SettingsPanel>
  );
}

/* ---------------------------------------------------------------- contact */

export function ContactPanel() {
  const form = useSettingsDraft({
    read: (settings) => ({ ...settings.contact, whatsapp: formatInternational(settings.contact.whatsapp) }),
    write: (draft) => ({ section: "contact", value: draft }),
    validate: (draft) => {
      const digits = normalizePhone(draft.whatsapp);
      return digits && !isValidWhatsAppNumber(digits)
        ? { whatsapp: "Use the full international number with the country code, e.g. +44 7700 900123" }
        : {};
    },
    saved: "Contact details saved",
  });
  const { draft, patch, errors } = form;
  const digits = normalizePhone(draft.whatsapp);
  const valid = isValidWhatsAppNumber(digits);

  return (
    <SettingsPanel
      id="contact"
      title="Contact and WhatsApp"
      description="How shoppers reach you. Shown on your contact page."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="settings-contact"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField
            label="WhatsApp number"
            optional
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="+44 7700 900123"
            value={draft.whatsapp}
            error={errors.whatsapp}
            onChange={(event) => patch({ whatsapp: event.target.value })}
            hint={
              valid
                ? `WhatsApp orders and questions open a chat with ${formatInternational(digits)}.`
                : "The number that receives WhatsApp orders — with the country code."
            }
            data-testid="whatsapp-number"
          />
          {!digits && (
            <div className="mt-3">
              <Notice tone="info" title="WhatsApp checkout is in demo mode">
                Without a number, shoppers who choose WhatsApp see the message they would send, but no chat opens and
                nothing is sent to anyone.
              </Notice>
            </div>
          )}
        </div>
        <TextField
          label="Email"
          optional
          type="email"
          autoComplete="off"
          value={draft.email}
          error={errors.email}
          onChange={(event) => patch({ email: event.target.value })}
        />
        <TextField
          label="Phone"
          optional
          type="tel"
          value={draft.phone}
          error={errors.phone}
          onChange={(event) => patch({ phone: event.target.value })}
        />
        <TextField
          label="Address"
          optional
          value={draft.address}
          maxLength={200}
          onChange={(event) => patch({ address: event.target.value })}
          hint="For a shop or pickup point. Leave blank if you only sell online."
        />
        <TextField
          label="Opening hours"
          optional
          value={draft.hours}
          maxLength={120}
          placeholder="Mon–Sat, 9:00–18:00"
          onChange={(event) => patch({ hours: event.target.value })}
        />
      </div>
    </SettingsPanel>
  );
}

/* ----------------------------------------------------------------- social */

const SOCIAL_FIELDS = [
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/yourstore" },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/yourstore" },
  { key: "tiktok", label: "TikTok", placeholder: "https://tiktok.com/@yourstore" },
  { key: "youtube", label: "YouTube", placeholder: "https://youtube.com/@yourstore" },
  { key: "x", label: "X", placeholder: "https://x.com/yourstore" },
  { key: "pinterest", label: "Pinterest", placeholder: "https://pinterest.com/yourstore" },
] as const;

export function SocialPanel() {
  const form = useSettingsDraft({
    read: (settings) => settings.social,
    write: (draft) => ({ section: "social", value: draft }),
    saved: "Social links saved",
  });
  return (
    <SettingsPanel
      id="social"
      title="Social links"
      description="Shown as icons in the footer. Leave a field blank to hide it."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
    >
      <div className="grid gap-5 md:grid-cols-2">
        {SOCIAL_FIELDS.map((field) => (
          <TextField
            key={field.key}
            label={field.label}
            optional
            type="url"
            inputMode="url"
            placeholder={field.placeholder}
            value={form.draft[field.key]}
            error={form.errors[field.key]}
            onChange={(event) => form.patch({ [field.key]: event.target.value })}
          />
        ))}
      </div>
    </SettingsPanel>
  );
}

/* --------------------------------------------------------------- checkout */

export function CheckoutPanel() {
  const stored = useStoredSettings();
  const form = useSettingsDraft({
    read: (settings) => settings.checkout,
    write: (draft) => ({ section: "checkout", value: draft }),
    validate: (draft) =>
      draft.bankTransfer && !draft.bankTransferInstructions.trim()
        ? { bankTransferInstructions: "Add the details shoppers need to pay you." }
        : {},
    saved: "Checkout saved",
  });
  const { draft, patch, errors } = form;
  const whatsappLive = isValidWhatsAppNumber(stored.contact.whatsapp);
  const none = !draft.cashOnDelivery && !draft.bankTransfer && !draft.whatsapp;

  return (
    <SettingsPanel
      id="checkout"
      title="Checkout and payment"
      description="How shoppers can order. Every order waits for you to confirm it before stock is set aside."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="settings-checkout"
    >
      <div className="space-y-6">
        <Toggle
          checked={draft.cashOnDelivery}
          onChange={(value) => patch({ cashOnDelivery: value })}
          label="Order on the website, pay on delivery"
          description="The shopper places the order here and pays when it arrives or at pickup."
        />
        <div className="space-y-4">
          <Toggle
            checked={draft.bankTransfer}
            onChange={(value) => patch({ bankTransfer: value })}
            label="Order on the website, pay by bank transfer"
            description="The shopper places the order and sees your payment details. Mark it paid once the money arrives."
          />
          {draft.bankTransfer && (
            <TextAreaField
              label="Payment details"
              rows={4}
              maxLength={1000}
              value={draft.bankTransferInstructions}
              error={errors.bankTransferInstructions}
              onChange={(event) => patch({ bankTransferInstructions: event.target.value })}
              hint="Account name, IBAN or account number, and what to write as the reference. Shown only after an order is placed."
            />
          )}
        </div>
        <div className="space-y-3">
          <Toggle
            checked={draft.whatsapp}
            onChange={(value) => patch({ whatsapp: value })}
            label="Order on WhatsApp"
            description="The shopper sends you a pre-written order in a WhatsApp chat. It appears in Orders as a handoff until you match it with your chat and confirm it."
          />
          {draft.whatsapp && !whatsappLive && (
            <Notice tone="warning">
              Demo mode: add your WhatsApp number under Contact and WhatsApp to send these orders to your phone.
            </Notice>
          )}
        </div>
        {none && (
          <Notice tone="danger" title="Shoppers can't order">
            With every method off, the shop still shows products, but checkout says ordering is unavailable.
          </Notice>
        )}
        <TextAreaField
          label="After-order note"
          optional
          rows={2}
          maxLength={300}
          value={draft.confirmationNote}
          onChange={(event) => patch({ confirmationNote: event.target.value })}
          placeholder="We'll call you within one working day to confirm your order."
          hint="Shown on the confirmation page after a website order."
        />
      </div>
    </SettingsPanel>
  );
}

/* --------------------------------------------------------------- delivery */

type MethodDraft = { id: string; name: string; description: string; price: string; requiresAddress: boolean };
type DeliveryDraft = { methods: MethodDraft[]; freeOver: boolean; threshold: string; areas: string };

const amount = (value: string) => Number(value.replace(",", ".").trim());
const isAmount = (value: string) => value.trim() !== "" && Number.isFinite(amount(value)) && amount(value) >= 0;

export function DeliveryPanel() {
  const stored = useStoredSettings();
  const currency = stored.store.currency;
  const form = useSettingsDraft<DeliveryDraft>({
    read: (settings) => ({
      methods: settings.shipping.methods.map((method) => ({ ...method, price: String(method.price) })),
      freeOver: settings.shipping.freeShippingThreshold !== null,
      threshold: settings.shipping.freeShippingThreshold === null ? "" : String(settings.shipping.freeShippingThreshold),
      areas: settings.shipping.areas,
    }),
    write: (draft) => ({
      section: "shipping",
      value: {
        methods: draft.methods.map((method) => ({ ...method, price: amount(method.price) })),
        freeShippingThreshold: draft.freeOver ? amount(draft.threshold) : null,
        areas: draft.areas,
      },
    }),
    validate: (draft) => {
      const problems: Record<string, string> = {};
      if (draft.methods.length === 0) problems.methods = "Add at least one way to get orders to shoppers.";
      draft.methods.forEach((method, index) => {
        if (!method.name.trim()) problems[`methods.${index}.name`] = "Name this option";
        if (!isAmount(method.price)) problems[`methods.${index}.price`] = "Enter a price — 0 if it's free";
      });
      if (draft.freeOver && !(isAmount(draft.threshold) && amount(draft.threshold) > 0)) {
        problems.freeShippingThreshold = "Enter the order total from which delivery is free";
      }
      return problems;
    },
    saved: "Delivery options saved",
  });
  const { draft, setDraft, errors } = form;

  const updateMethod = (index: number, changes: Partial<MethodDraft>) =>
    setDraft((current) => ({
      ...current,
      methods: current.methods.map((method, position) => (position === index ? { ...method, ...changes } : method)),
    }));
  const moveMethod = (index: number, delta: number) =>
    setDraft((current) => {
      const methods = [...current.methods];
      const [method] = methods.splice(index, 1);
      methods.splice(index + delta, 0, method);
      return { ...current, methods };
    });

  return (
    <SettingsPanel
      id="delivery"
      title="Delivery"
      description="The options shoppers choose from at checkout, in this order."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
      testId="settings-delivery"
    >
      <div className="space-y-4">
        {errors.methods && <Notice tone="danger">{errors.methods}</Notice>}
        {draft.methods.map((method, index) => (
          <fieldset key={method.id} className="rounded-[12px] border border-line p-4">
            <legend className="sr-only">Delivery option {index + 1}</legend>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <TextField
                label="Name"
                value={method.name}
                maxLength={60}
                placeholder="Standard delivery"
                error={errors[`methods.${index}.name`]}
                onChange={(event) => updateMethod(index, { name: event.target.value })}
              />
              <TextField
                label="Price"
                inputMode="decimal"
                value={method.price}
                suffix={currency}
                error={errors[`methods.${index}.price`]}
                onChange={(event) => updateMethod(index, { price: event.target.value })}
              />
              <TextField
                label="Details"
                optional
                className="sm:col-span-2"
                value={method.description}
                maxLength={160}
                placeholder="2–4 working days"
                onChange={(event) => updateMethod(index, { description: event.target.value })}
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!method.requiresAddress}
                  onChange={(event) => updateMethod(index, { requiresAddress: !event.target.checked })}
                  className="size-4 accent-[var(--accent)]"
                />
                Pickup — no address needed
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveMethod(index, -1)}
                  disabled={index === 0}
                  className="grid size-8 place-items-center rounded-[8px] text-ink-3 hover:bg-canvas hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${method.name || "option"} up`}
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => moveMethod(index, 1)}
                  disabled={index === draft.methods.length - 1}
                  className="grid size-8 place-items-center rounded-[8px] text-ink-3 hover:bg-canvas hover:text-ink disabled:opacity-30"
                  aria-label={`Move ${method.name || "option"} down`}
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({ ...current, methods: current.methods.filter((_, position) => position !== index) }))
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-sm text-ink-3 hover:bg-canvas hover:text-danger"
                >
                  <Trash2 size={14} /> Remove
                </button>
              </div>
            </div>
          </fieldset>
        ))}
        {draft.methods.length < 8 && (
          <button
            type="button"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                methods: [
                  ...current.methods,
                  { id: `option-${uid().slice(0, 8)}`, name: "", description: "", price: "", requiresAddress: true },
                ],
              }))
            }
            className={buttonClass({ variant: "outline", size: "sm" })}
          >
            <Plus size={15} /> Add delivery option
          </button>
        )}

        <div className="space-y-4 border-t border-line pt-5">
          <Toggle
            checked={draft.freeOver}
            onChange={(value) => setDraft((current) => ({ ...current, freeOver: value }))}
            label="Free delivery above an order total"
            description="Every delivery option becomes free once the bag reaches this amount, and the bag tells shoppers how much is left."
          />
          {draft.freeOver && (
            <TextField
              label="Free from"
              inputMode="decimal"
              className="max-w-56"
              suffix={currency}
              value={draft.threshold}
              error={errors.freeShippingThreshold}
              onChange={(event) => setDraft((current) => ({ ...current, threshold: event.target.value }))}
            />
          )}
          <TextField
            label="Where you deliver"
            optional
            value={draft.areas}
            maxLength={160}
            placeholder="Across the United States"
            error={errors.areas}
            onChange={(event) => setDraft((current) => ({ ...current, areas: event.target.value }))}
            hint="One short sentence, shown with your delivery promise on the homepage."
          />
        </div>
      </div>
    </SettingsPanel>
  );
}

/* --------------------------------------------------------------- policies */

const POLICY_FIELDS = [
  { key: "about", label: "About us", hint: "Your story. The page appears in the footer once it has text." },
  { key: "shipping", label: "Delivery", hint: "Where you deliver, how long it takes, what it costs." },
  { key: "returns", label: "Returns and exchanges", hint: "What can come back, for how long, and how." },
  { key: "privacy", label: "Privacy", hint: "What you do with the details shoppers give you at checkout." },
] as const;

export function PoliciesPanel() {
  const form = useSettingsDraft({
    read: (settings) => settings.policies,
    write: (draft) => ({ section: "policies", value: draft }),
    saved: "Pages saved",
  });
  return (
    <SettingsPanel
      id="pages"
      title="Pages"
      description="Plain text: a blank line starts a new paragraph, a line starting with “- ” is a list item, “### ” a small heading."
      dirty={form.dirty}
      busy={form.busy}
      onSave={form.save}
      onReset={form.reset}
    >
      <div className="space-y-5">
        {POLICY_FIELDS.map((field) => (
          <TextAreaField
            key={field.key}
            label={field.label}
            optional
            rows={5}
            maxLength={5000}
            value={form.draft[field.key]}
            onChange={(event) => form.patch({ [field.key]: event.target.value })}
            hint={field.hint}
          />
        ))}
      </div>
    </SettingsPanel>
  );
}

/* ------------------------------------------------------------------- demo */

export function DemoPanel({
  counts,
  preview = false,
}: {
  counts: { products: number; categories: number; collections: number };
  preview?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [includeSettings, setIncludeSettings] = useState(false);
  const total = counts.products + counts.categories + counts.collections;

  return (
    <Panel id="demo" title="Demo content" description="Sample products that make a new shop look complete while you set it up.">
      {preview ? (
        <p className="text-sm text-ink-2">
          This store shows <strong className="text-ink">{counts.products} demo products</strong>. In your own store, this is
          where you remove them all in one click once your products are in — or bring them back.
        </p>
      ) : total > 0 ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Your shop has <strong className="text-ink">{counts.products} demo products</strong>, {counts.categories} demo
            categories and {counts.collections} demo collections. They are fictional and marked “Demo” in your lists.
          </p>
          <ConfirmButton
            variant="outline"
            title="Remove all demo content?"
            description={
              <>
                This deletes the {counts.products} demo products and the demo categories and collections. Your own products,
                your settings and every order stay as they are — orders keep a copy of what was bought.
              </>
            }
            confirmLabel="Remove demo content"
            onConfirm={async () => {
              const result = await removeDemoAction();
              if (result.ok) {
                toast("success", `Removed ${result.data.products} demo products`);
                router.refresh();
              } else toast("danger", result.error);
            }}
          >
            <span data-testid="remove-demo">Remove demo content</span>
          </ConfirmButton>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            No demo content in your shop. You can bring the sample products back — useful for trying a theme before your own
            photos are ready.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeSettings}
              onChange={(event) => setIncludeSettings(event.target.checked)}
              className="mt-0.5 size-4 accent-[var(--accent)]"
            />
            <span>
              Also use the demo store&apos;s name, homepage, delivery options and pages
              <span className="block text-xs text-ink-3">Replaces yours. Contact details, checkout and theme stay.</span>
            </span>
          </label>
          <ConfirmButton
            variant="outline"
            confirmVariant="primary"
            title="Add the demo content?"
            description={
              includeSettings
                ? "Adds 30 sample products in 5 categories and 3 collections, and replaces your store name, homepage, delivery options and pages with the demo ones."
                : "Adds 30 sample products in 5 categories and 3 collections. Nothing of yours is changed; a demo item never takes a handle you already use."
            }
            confirmLabel="Add demo content"
            onConfirm={async () => {
              const result = await loadDemoAction({ includeSettings });
              if (result.ok) {
                toast("success", `Added ${result.data.products} demo products`);
                router.refresh();
              } else toast("danger", result.error);
            }}
          >
            Add demo content
          </ConfirmButton>
        </div>
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- account */

export function AccountPanel({ email, backend }: { email: string; backend: "local" | "supabase" }) {
  // React clears the fields once the action has run.
  const [state, action, pending] = useActionState(changePasswordAction, {});

  return (
    <Panel
      id="account"
      title="Your account"
      description={
        backend === "supabase"
          ? `Signed in as ${email}. Accounts are managed by Supabase Auth.`
          : `Signed in as ${email}. The password is stored hashed on this server.`
      }
    >
      <form action={action} className="grid max-w-xl gap-4">
        {state?.error && <Notice tone="danger">{state.error}</Notice>}
        {state?.ok && <Notice tone="success">Password changed.</Notice>}
        <TextField label="Current password" name="current" type="password" autoComplete="current-password" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="New password"
            name="next"
            type="password"
            autoComplete="new-password"
            hint="At least 10 characters."
            required
          />
          <TextField label="Repeat new password" name="confirm" type="password" autoComplete="new-password" required />
        </div>
        <div>
          <button type="submit" disabled={pending} className={buttonClass({ variant: "outline", size: "sm" })}>
            {pending ? "Changing…" : "Change password"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

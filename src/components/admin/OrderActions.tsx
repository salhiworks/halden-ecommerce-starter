"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { ORDER_STATUS_META, ORDER_TRANSITIONS, TRANSITION_LABELS, stockEffect } from "@/lib/domain/orders";
import type { Order, OrderStatus, PaymentStatus } from "@/lib/domain/types";
import { deleteOrderAction, transitionOrderAction, updateOrderAction } from "@/server/actions/admin";
import { ConfirmButton, Modal, TextAreaField, useToast } from "./ui";

/** The buttons that move an order along, with a note for the history. */
export function OrderStatusActions({ order }: { order: Order }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<OrderStatus | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const next = ORDER_TRANSITIONS[order.status];

  if (next.length === 0) return null;

  const run = async () => {
    if (!target) return;
    setBusy(true);
    const result = await transitionOrderAction(order.id, order.status, target, note);
    setBusy(false);
    if (result.ok) {
      toast("success", `Order #${order.number}: ${ORDER_STATUS_META[target].label}`);
      setTarget(null);
      setNote("");
      router.refresh();
    } else {
      toast("danger", result.error);
    }
  };

  const effect = target ? stockEffect(order, target) : 0;
  const closed = order.status === "cancelled" || order.status === "discarded";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {next.map((status) => {
          const destructive = status === "cancelled" || status === "discarded";
          return (
            <button
              key={status}
              type="button"
              onClick={() => setTarget(status)}
              className={buttonClass({ variant: destructive ? "outline" : "primary", size: "md" })}
              data-testid={`transition-${status}`}
            >
              {closed && status === "received" ? "Reopen order" : TRANSITION_LABELS[status]}
            </button>
          );
        })}
      </div>
      <Modal
        open={target !== null}
        onClose={() => !busy && setTarget(null)}
        title={target ? `${TRANSITION_LABELS[target]} — order #${order.number}` : ""}
        footer={
          <>
            <button type="button" className={buttonClass({ variant: "ghost" })} onClick={() => setTarget(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={buttonClass({ variant: target === "cancelled" || target === "discarded" ? "danger" : "primary" })}
              onClick={run}
              disabled={busy}
              data-testid="confirm-transition"
            >
              {busy ? "Saving…" : target ? TRANSITION_LABELS[target] : ""}
            </button>
          </>
        }
      >
        {target && (
          <div className="space-y-4 text-sm">
            <p className="text-ink-2">{ORDER_STATUS_META[target].description}</p>
            {target === "received" && order.channel === "whatsapp" && order.status !== "cancelled" && (
              <p className="rounded-[10px] bg-warning-soft px-3 py-2 text-warning">
                Only continue if you have the WhatsApp message for order #{order.number} in your chats.
              </p>
            )}
            {effect === 1 && (
              <p className="rounded-[10px] bg-canvas px-3 py-2">
                Confirming takes these items out of stock (for products that track inventory).
              </p>
            )}
            {effect === -1 && (
              <p className="rounded-[10px] bg-canvas px-3 py-2">The items reserved for this order go back into stock.</p>
            )}
            <TextAreaField
              label="Note for the order history"
              optional
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={target === "cancelled" ? "Why it was cancelled" : "e.g. Confirmed by phone with the customer"}
            />
          </div>
        )}
      </Modal>
    </>
  );
}

export function PaymentStatusControl({ order }: { order: Order }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const set = async (paymentStatus: PaymentStatus) => {
    setBusy(true);
    const result = await updateOrderAction(order.id, { paymentStatus });
    setBusy(false);
    if (result.ok) {
      toast("success", paymentStatus === "paid" ? "Marked as paid" : paymentStatus === "refunded" ? "Marked as refunded" : "Marked as unpaid");
      router.refresh();
    } else toast("danger", result.error);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {order.paymentStatus !== "paid" && (
        <button type="button" disabled={busy} onClick={() => set("paid")} className={buttonClass({ variant: "dark", size: "sm" })}>
          Mark as paid
        </button>
      )}
      {order.paymentStatus === "paid" && (
        <>
          <button type="button" disabled={busy} onClick={() => set("unpaid")} className={buttonClass({ variant: "outline", size: "sm" })}>
            Mark as unpaid
          </button>
          <button type="button" disabled={busy} onClick={() => set("refunded")} className={buttonClass({ variant: "outline", size: "sm" })}>
            Mark as refunded
          </button>
        </>
      )}
      {order.paymentStatus === "refunded" && (
        <button type="button" disabled={busy} onClick={() => set("unpaid")} className={buttonClass({ variant: "outline", size: "sm" })}>
          Mark as unpaid
        </button>
      )}
    </div>
  );
}

export function InternalNote({ order }: { order: Order }) {
  const router = useRouter();
  const toast = useToast();
  const [value, setValue] = useState(order.internalNote);
  const [busy, setBusy] = useState(false);
  const dirty = value !== order.internalNote;
  return (
    <div>
      <TextAreaField
        label="Private note"
        hint="Only you see this — tracking numbers, what the customer asked for on the phone…"
        rows={3}
        value={value}
        maxLength={2000}
        onChange={(event) => setValue(event.target.value)}
      />
      {dirty && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await updateOrderAction(order.id, { internalNote: value });
            setBusy(false);
            if (result.ok) {
              toast("success", "Note saved");
              router.refresh();
            } else toast("danger", result.error);
          }}
          className={buttonClass({ variant: "dark", size: "sm", className: "mt-2" })}
        >
          {busy ? "Saving…" : "Save note"}
        </button>
      )}
    </div>
  );
}

export function DeleteOrderButton({ order }: { order: Order }) {
  const router = useRouter();
  const toast = useToast();
  if (!["prepared", "opened", "cancelled", "discarded"].includes(order.status)) return null;
  return (
    <ConfirmButton
      size="sm"
      variant="ghost"
      className="text-danger"
      title={`Delete order #${order.number}?`}
      description="The order and its customer details are removed for good. Only cancelled orders and unverified WhatsApp handoffs can be deleted — confirmed sales are kept for your records."
      confirmLabel="Delete order"
      onConfirm={async () => {
        const result = await deleteOrderAction(order.id);
        if (result.ok) {
          toast("success", `Order #${order.number} deleted`);
          router.push("/admin/orders");
          router.refresh();
        } else toast("danger", result.error);
      }}
    >
      Delete order
    </ConfirmButton>
  );
}

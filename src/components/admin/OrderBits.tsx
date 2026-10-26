import { Globe } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/brands";
import { ORDER_STATUS_META, PAYMENT_STATUS_LABELS } from "@/lib/domain/orders";
import type { Order } from "@/lib/domain/types";
import { Pill, type Tone } from "./ui";

/** Small, shared pieces for showing orders in the dashboard. */

export function OrderStatusPill({ status }: { status: Order["status"] }) {
  const meta = ORDER_STATUS_META[status];
  return <Pill tone={meta.tone as Tone}>{meta.label}</Pill>;
}

export function PaymentPill({ order }: { order: Pick<Order, "paymentStatus"> }) {
  const tone: Tone = order.paymentStatus === "paid" ? "success" : order.paymentStatus === "refunded" ? "muted" : "neutral";
  return <Pill tone={tone}>{PAYMENT_STATUS_LABELS[order.paymentStatus]}</Pill>;
}

export function ChannelBadge({ channel }: { channel: Order["channel"] }) {
  return channel === "whatsapp" ? (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#127C45]">
      <WhatsAppIcon size={13} /> WhatsApp
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-2">
      <Globe size={13} /> Website
    </span>
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function formatRelative(iso: string, now = Date.now()): string {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} d ago`;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(iso));
}

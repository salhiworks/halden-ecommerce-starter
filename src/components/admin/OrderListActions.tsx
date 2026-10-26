"use client";

import { useRouter } from "next/navigation";
import { discardStaleHandoffsAction } from "@/server/actions/admin";
import { ConfirmButton, useToast } from "./ui";

export function DiscardStaleButton({ count }: { count: number }) {
  const toast = useToast();
  const router = useRouter();
  if (count === 0) return null;
  return (
    <ConfirmButton
      size="sm"
      title="Discard old WhatsApp handoffs?"
      description={`${count} ${count === 1 ? "handoff is" : "handoffs are"} more than a week old with no confirmed message. Discarding keeps them in your records (as "Discarded handoff") but takes them off your to-do list. Nothing is sent to anyone.`}
      confirmLabel="Discard"
      confirmVariant="dark"
      onConfirm={async () => {
        const result = await discardStaleHandoffsAction();
        if (result.ok) {
          toast("success", `Discarded ${result.data.discarded} old ${result.data.discarded === 1 ? "handoff" : "handoffs"}`);
          router.refresh();
        } else toast("danger", result.error);
      }}
    >
      Discard {count} older than a week
    </ConfirmButton>
  );
}

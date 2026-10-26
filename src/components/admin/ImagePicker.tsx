"use client";

import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { uploadImage } from "@/lib/image-upload";
import { useToast } from "./ui";

/**
 * A single image (logo, category photo, hero, banner): upload or replace,
 * preview, remove.
 */
export function ImagePicker({
  label,
  value,
  onChange,
  aspect = "aspect-[4/5]",
  hint,
  fit = "cover",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: string;
  hint?: string;
  fit?: "cover" | "contain";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadImage(file);
      onChange(uploaded.url);
    } catch (error) {
      toast("danger", error instanceof Error ? error.message : "The upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      <div
        className={`relative overflow-hidden rounded-[12px] border border-dashed border-line-strong bg-canvas ${aspect}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          void pick(event.dataTransfer.files[0]);
        }}
      >
        {value ? (
          <Image src={value} alt="" fill sizes="320px" className={fit === "contain" ? "object-contain p-4" : "object-cover"} />
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-ink-2 hover:text-ink"
          >
            <ImagePlus size={22} />
            Upload a photo
          </button>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-paper/70">
            <LoaderCircle size={22} className="animate-spin" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-3 text-sm">
        {value && (
          <>
            <button type="button" onClick={() => input.current?.click()} className="font-medium underline-offset-4 hover:underline">
              Replace
            </button>
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-ink-3 hover:text-danger">
              <Trash2 size={14} /> Remove
            </button>
          </>
        )}
        {hint && <span className="text-xs text-ink-3">{hint}</span>}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        onChange={(event) => void pick(event.target.files?.[0])}
      />
    </div>
  );
}

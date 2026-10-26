"use client";

import { ArrowLeft, ArrowRight, ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ProductImage } from "@/lib/domain/types";
import { uploadImage } from "@/lib/image-upload";
import { uid } from "@/lib/uid";
import { useToast } from "./ui";

export const MAX_PRODUCT_IMAGES = 12;

/**
 * A product's photos: drop or pick several at once, reorder (the first is the
 * card and share image), describe each for screen readers, remove.
 */
export function MediaManager({
  images,
  onChange,
  error,
}: {
  images: ProductImage[];
  onChange: (images: ProductImage[]) => void;
  error?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const toast = useToast();
  // Uploads finish one by one; each adds to the list as it is by then.
  const latest = useRef(images);
  useEffect(() => {
    latest.current = images;
  }, [images]);

  const addFiles = async (files: FileList | File[]) => {
    const room = MAX_PRODUCT_IMAGES - latest.current.length;
    const list = [...files].slice(0, Math.max(0, room));
    if (files.length > list.length) toast("info", `A product can have up to ${MAX_PRODUCT_IMAGES} photos.`);
    setUploading((count) => count + list.length);
    for (const file of list) {
      try {
        const uploaded = await uploadImage(file);
        onChange([
          ...latest.current,
          { id: uid(), url: uploaded.url, alt: "", width: uploaded.width, height: uploaded.height },
        ]);
      } catch (cause) {
        toast("danger", cause instanceof Error ? cause.message : "The upload failed.");
      } finally {
        setUploading((count) => count - 1);
      }
    }
    if (input.current) input.current.value = "";
  };

  const move = (index: number, delta: number) => {
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          if (event.dataTransfer.files.length) void addFiles(event.dataTransfer.files);
        }}
        className={`grid grid-cols-2 gap-3 rounded-[12px] sm:grid-cols-3 lg:grid-cols-4 ${dragOver ? "outline-2 outline-dashed outline-accent outline-offset-4" : ""}`}
      >
        {images.map((image, index) => (
          <figure key={image.id} className="group flex flex-col gap-2">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-tile">
              <Image src={image.url} alt={image.alt || ""} fill sizes="200px" className="object-cover" />
              {index === 0 && (
                <span className="absolute start-2 top-2 rounded-full bg-paper/95 px-2 py-0.5 text-[0.7rem] font-semibold">Main photo</span>
              )}
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                <span className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="grid size-8 place-items-center rounded-full bg-paper/95 shadow disabled:opacity-40"
                    aria-label={`Move photo ${index + 1} earlier`}
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === images.length - 1}
                    className="grid size-8 place-items-center rounded-full bg-paper/95 shadow disabled:opacity-40"
                    aria-label={`Move photo ${index + 1} later`}
                  >
                    <ArrowRight size={15} />
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => onChange(images.filter((candidate) => candidate.id !== image.id))}
                  className="grid size-8 place-items-center rounded-full bg-paper/95 text-danger shadow"
                  aria-label={`Remove photo ${index + 1}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <input
              value={image.alt}
              onChange={(event) =>
                onChange(images.map((candidate) => (candidate.id === image.id ? { ...candidate, alt: event.target.value } : candidate)))
              }
              placeholder="Describe the photo"
              aria-label={`Description of photo ${index + 1}`}
              maxLength={200}
              className="w-full rounded-[8px] border border-line bg-paper px-2.5 py-1.5 text-xs outline-none focus:border-ink"
            />
          </figure>
        ))}

        {Array.from({ length: uploading }, (_, index) => (
          <div key={`uploading-${index}`} className="grid aspect-[4/5] place-items-center rounded-[10px] bg-canvas">
            <LoaderCircle size={22} className="animate-spin text-ink-3" />
          </div>
        ))}

        {images.length + uploading < MAX_PRODUCT_IMAGES && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-line-strong bg-canvas px-3 text-center text-sm text-ink-2 hover:border-ink hover:text-ink"
          >
            <ImagePlus size={22} />
            <span className="font-medium">Add photos</span>
            <span className="text-xs text-ink-3">or drop them here</span>
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-medium text-danger">{error}</p>}
      <p className="mt-3 text-xs text-ink-3">
        Photos are resized automatically. Portrait (4:5) photos on a plain background look best. The first photo is used on
        product cards and when the page is shared.
      </p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(event) => event.target.files && void addFiles(event.target.files)}
      />
    </div>
  );
}

"use client";

import { ArrowDown, ArrowUp, EyeOff, FolderTree, Pencil, Plus, Search } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { slugify, slugInput, uniqueSlug } from "@/lib/domain/slug";
import type { Grouping, Product } from "@/lib/domain/types";
import {
  deleteGroupingAction,
  reorderGroupingsAction,
  saveGroupingAction,
  setCollectionProductsAction,
} from "@/server/actions/admin";
import { ImagePicker } from "./ImagePicker";
import { ConfirmButton, EmptyState, Modal, Panel, Pill, TextAreaField, TextField, Toggle, useToast } from "./ui";

type Kind = "category" | "collection";
export type ProductRef = {
  id: string;
  name: string;
  imageUrl: string | null;
  status: Product["status"];
  categoryId: string | null;
  collectionIds: string[];
};

const COPY = {
  category: {
    singular: "category",
    plural: "categories",
    deleteText:
      "Products in this category stay in your store, without a category. You can move them to another one afterwards.",
    path: "categories",
  },
  collection: {
    singular: "collection",
    plural: "collections",
    deleteText: "Products in this collection stay in your store; they're only removed from this collection.",
    path: "collections",
  },
} as const;

export function GroupingManager({ kind, items, products }: { kind: Kind; items: Grouping[]; products: ProductRef[] }) {
  const router = useRouter();
  const toast = useToast();
  const [order, setOrder] = useState(items);
  const [editing, setEditing] = useState<Grouping | "new" | null>(null);
  const copy = COPY[kind];

  // Follow server updates (a save elsewhere, a refresh) without losing order.
  const ids = items.map((item) => `${item.id}:${item.updatedAt}:${item.sortOrder}`).join();
  const [lastIds, setLastIds] = useState(ids);
  if (ids !== lastIds) {
    setLastIds(ids);
    setOrder(items);
  }

  const count = (id: string) =>
    products.filter((product) => (kind === "category" ? product.categoryId === id : product.collectionIds.includes(id))).length;

  const move = async (index: number, delta: number) => {
    const next = [...order];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setOrder(next);
    const result = await reorderGroupingsAction(kind, next.map((entry) => entry.id));
    if (!result.ok) {
      toast("danger", result.error);
      setOrder(order);
    } else router.refresh();
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setEditing("new")} className={buttonClass()} data-testid={`new-${kind}`}>
          <Plus size={17} /> Add {copy.singular}
        </button>
      </div>
      <Panel padded={false}>
        {order.length === 0 ? (
          <EmptyState icon={<FolderTree size={20} />} title={`No ${copy.plural} yet`}>
            {kind === "category"
              ? "Categories are the aisles of your store — like “Audio”, “Kitchen” or “Shoes”. Each product belongs to one."
              : "Collections are hand-picked groups that can mix categories — “Gift guide”, “Summer sale”, “Best sellers”."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {order.map((item, index) => (
              <li key={item.id} className="flex items-center gap-4 px-5 py-3">
                <span className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="grid size-7 place-items-center rounded text-ink-3 hover:bg-canvas hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${item.name} up`}
                  >
                    <ArrowUp size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === order.length - 1}
                    className="grid size-7 place-items-center rounded text-ink-3 hover:bg-canvas hover:text-ink disabled:opacity-30"
                    aria-label={`Move ${item.name} down`}
                  >
                    <ArrowDown size={15} />
                  </button>
                </span>
                <span className="relative size-14 shrink-0 overflow-hidden rounded-[10px] bg-tile">
                  {item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium" data-testid="grouping-name">
                      {item.name}
                    </span>
                    {!item.visible && (
                      <Pill tone="muted">
                        <EyeOff size={12} /> Hidden
                      </Pill>
                    )}
                    {item.isDemo && <Pill tone="muted">Demo</Pill>}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    /{copy.path}/{item.slug} · {count(item.id)} {count(item.id) === 1 ? "product" : "products"}
                  </span>
                </span>
                <button type="button" onClick={() => setEditing(item)} className={buttonClass({ variant: "outline", size: "sm" })}>
                  <Pencil size={14} /> Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {editing && (
        <GroupingDialog
          kind={kind}
          item={editing === "new" ? null : editing}
          products={products}
          taken={new Set(order.filter((entry) => editing === "new" || entry.id !== editing.id).map((entry) => entry.slug))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function GroupingDialog({
  kind,
  item,
  products,
  taken,
  onClose,
  onSaved,
}: {
  kind: Kind;
  item: Grouping | null;
  products: ProductRef[];
  taken: Set<string>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const copy = COPY[kind];
  const [name, setName] = useState(item?.name ?? "");
  const [slug, setSlug] = useState(item?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(item));
  const [description, setDescription] = useState(item?.description ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [visible, setVisible] = useState(item?.visible ?? true);
  const [members, setMembers] = useState<Set<string>>(
    () => new Set(item ? products.filter((product) => product.collectionIds.includes(item.id)).map((product) => product.id) : []),
  );
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const visibleProducts = useMemo(
    () => products.filter((product) => product.name.toLowerCase().includes(filter.trim().toLowerCase())),
    [products, filter],
  );

  const save = async () => {
    setBusy(true);
    // A typed handle is kept as typed; a suggested one steps aside for an
    // existing handle ("sale" → "sale-2").
    const typed = slugify(slug);
    const finalSlug = typed && (slugTouched || !taken.has(typed)) ? typed : uniqueSlug(name, taken, kind);
    const result = await saveGroupingAction(kind, {
      id: item?.id,
      name,
      slug: finalSlug,
      description,
      imageUrl,
      visible,
    });
    if (!result.ok) {
      setBusy(false);
      setErrors(result.fieldErrors ?? {});
      toast("danger", result.error);
      return;
    }
    if (kind === "collection") {
      const membership = await setCollectionProductsAction(result.data.id, [...members]);
      if (!membership.ok) {
        setBusy(false);
        toast("danger", membership.error);
        return;
      }
    }
    setBusy(false);
    toast("success", item ? `${name} saved` : `${name} created`);
    onSaved();
  };

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={item ? `Edit ${copy.singular}` : `New ${copy.singular}`}
      size={kind === "collection" ? "lg" : "md"}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {item ? (
            <ConfirmButton
              variant="ghost"
              size="sm"
              className="text-danger"
              title={`Delete “${item.name}”?`}
              description={copy.deleteText}
              confirmLabel={`Delete ${copy.singular}`}
              onConfirm={async () => {
                const result = await deleteGroupingAction(kind, item.id);
                if (result.ok) {
                  toast("success", `${item.name} deleted`);
                  onSaved();
                } else toast("danger", result.error);
              }}
            >
              Delete
            </ConfirmButton>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={busy} className={buttonClass({ variant: "ghost" })}>
              Cancel
            </button>
            <button type="button" onClick={save} disabled={busy || !name.trim()} className={buttonClass()} data-testid="save-grouping">
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      }
    >
      <div className={kind === "collection" ? "grid gap-6 md:grid-cols-2" : ""}>
        <div className="space-y-4">
          <TextField
            label="Name"
            value={name}
            maxLength={60}
            error={errors.name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugTouched) setSlug(slugify(event.target.value));
            }}
            autoFocus
          />
          <TextField
            label="URL handle"
            prefix={`/${copy.path}/`}
            value={slug}
            error={errors.slug}
            className="[&_input]:ps-28"
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(slugInput(event.target.value));
            }}
          />
          <TextAreaField
            label="Description"
            optional
            rows={3}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            hint="Shown at the top of the page."
          />
          <ImagePicker label="Photo" value={imageUrl} onChange={setImageUrl} aspect="aspect-[3/2]" hint="Used on the homepage and when shared." />
          <Toggle
            checked={visible}
            onChange={setVisible}
            label="Visible in the store"
            description={
              kind === "category"
                ? "Hidden categories, and the products in them, are not shown to shoppers."
                : "Hidden collections have no page and don't appear on the homepage."
            }
          />
        </div>

        {kind === "collection" && (
          <div>
            <p className="mb-1.5 text-sm font-medium">
              Products <span className="font-normal text-ink-3">({members.size} selected)</span>
            </p>
            <div className="relative mb-2">
              <Search size={15} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Find a product"
                aria-label="Find a product"
                className="h-9 w-full rounded-[10px] border border-line-strong bg-paper pe-3 ps-8 text-sm outline-none focus:border-ink"
              />
            </div>
            <ul className="max-h-80 divide-y divide-line overflow-y-auto rounded-[10px] border border-line">
              {visibleProducts.map((product) => (
                <li key={product.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-canvas">
                    <input
                      type="checkbox"
                      checked={members.has(product.id)}
                      onChange={(event) =>
                        setMembers((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(product.id);
                          else next.delete(product.id);
                          return next;
                        })
                      }
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className="relative size-8 shrink-0 overflow-hidden rounded-[6px] bg-tile">
                      {product.imageUrl && <Image src={product.imageUrl} alt="" fill sizes="32px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{product.name}</span>
                    {product.status !== "active" && (
                      <span className="shrink-0 text-xs text-ink-3">{product.status === "draft" ? "Draft" : "Archived"}</span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { addresses } from "@/db/schema";
import { requireUser } from "./_auth";

type AddressInput = {
  label?: string | null;
  recipient_name?: string | null;
  phone?: string | null;
  address: string;
  city?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  is_default?: boolean;
};

const clean = (v?: string | null) => {
  const s = (v ?? "").toString().trim();
  return s ? s.slice(0, 500) : null;
};

export const listMyAddresses = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  return getDb()
    .select()
    .from(addresses)
    .where(eq(addresses.user_id, user.id))
    .orderBy(desc(addresses.is_default), desc(addresses.created_at));
});

export const saveAddress = createServerFn({ method: "POST" })
  .inputValidator((d: AddressInput) => d)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const address = clean(data.address);
    if (!address) throw new Error("Address is required");

    // The first address a user saves is always their default; after that, only
    // when they ask for it. Setting a new default clears the previous one.
    const existing = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(eq(addresses.user_id, user.id));
    const makeDefault = data.is_default || existing.length === 0;
    if (makeDefault && existing.length > 0) {
      await db.update(addresses).set({ is_default: false }).where(eq(addresses.user_id, user.id));
    }

    const [row] = await db
      .insert(addresses)
      .values({
        user_id: user.id,
        label: clean(data.label),
        recipient_name: clean(data.recipient_name),
        phone: clean(data.phone),
        address,
        city: clean(data.city),
        location_lat: data.location_lat ?? null,
        location_lng: data.location_lng ?? null,
        is_default: makeDefault,
      })
      .returning();
    return row;
  });

export const updateAddress = createServerFn({ method: "POST" })
  .inputValidator((d: AddressInput & { id: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    // SECURITY: an address may only be edited by its owner — match on both the
    // id and the caller's user id, never the client-sent id alone.
    const [owned] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, data.id), eq(addresses.user_id, user.id)));
    if (!owned) throw new Error("Address not found");
    const address = clean(data.address);
    if (!address) throw new Error("Address is required");

    const makeDefault = data.is_default ?? owned.is_default;
    if (makeDefault && !owned.is_default) {
      await db.update(addresses).set({ is_default: false }).where(eq(addresses.user_id, user.id));
    }
    await db
      .update(addresses)
      .set({
        label: clean(data.label),
        recipient_name: clean(data.recipient_name),
        phone: clean(data.phone),
        address,
        city: clean(data.city),
        location_lat: data.location_lat ?? null,
        location_lng: data.location_lng ?? null,
        is_default: makeDefault,
      })
      .where(eq(addresses.id, data.id));
    return { ok: true };
  });

export const setDefaultAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const [owned] = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(and(eq(addresses.id, data.id), eq(addresses.user_id, user.id)));
    if (!owned) throw new Error("Address not found");
    await db.update(addresses).set({ is_default: false }).where(eq(addresses.user_id, user.id));
    await db.update(addresses).set({ is_default: true }).where(eq(addresses.id, data.id));
    return { ok: true };
  });

export const deleteAddress = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const user = await requireUser();
    const db = getDb();
    const [owned] = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.id, data.id), eq(addresses.user_id, user.id)));
    if (!owned) throw new Error("Address not found");
    await db.delete(addresses).where(eq(addresses.id, data.id));
    // If the default was removed, promote the most recent remaining address so a
    // user always has one default to pre-select at checkout.
    if (owned.is_default) {
      const [next] = await db
        .select({ id: addresses.id })
        .from(addresses)
        .where(eq(addresses.user_id, user.id))
        .orderBy(desc(addresses.created_at))
        .limit(1);
      if (next) {
        await db.update(addresses).set({ is_default: true }).where(eq(addresses.id, next.id));
      }
    }
    return { ok: true };
  });

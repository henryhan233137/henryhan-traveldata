import { env } from "cloudflare:workers";
import type { TripSnapshot } from "@/lib/trip-data";

const DEFAULT_ID = "seoul-busan-winter";

export type StoredTrip = { ownerId: string; trip: TripSnapshot; updatedAt: string };

export async function loadSharedTrip(): Promise<StoredTrip | null> {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT owner_id AS ownerId, snapshot, updated_at AS updatedAt FROM trips WHERE id = ? LIMIT 1",
  ).bind(DEFAULT_ID).first<{ ownerId: string; snapshot: string; updatedAt: string }>();
  if (!row) return null;
  return { ownerId: row.ownerId, trip: JSON.parse(row.snapshot) as TripSnapshot, updatedAt: row.updatedAt };
}

export async function loadOwnerTrip(ownerId: string): Promise<TripSnapshot | null> {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    "SELECT snapshot FROM trips WHERE id = ? AND owner_id = ? LIMIT 1",
  ).bind(DEFAULT_ID, ownerId).first<{ snapshot: string }>();
  if (!row) return null;
  return JSON.parse(row.snapshot) as TripSnapshot;
}

export async function saveOwnerTrip(ownerId: string, trip: TripSnapshot) {
  if (!env.DB) throw new Error("旅行数据库暂时不可用");
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO trips (id, owner_id, slug, visibility, title, snapshot, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       visibility = excluded.visibility,
       title = excluded.title,
       snapshot = excluded.snapshot,
       updated_at = excluded.updated_at`,
  ).bind(DEFAULT_ID, ownerId, "seoul-busan-winter", "shared", trip.title, JSON.stringify(trip), now).run();
  return { updatedAt: now };
}

export async function saveSharedTrip(trip: TripSnapshot) {
  if (!env.DB) throw new Error("旅行数据库暂时不可用");
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE trips SET title = ?, snapshot = ?, updated_at = ? WHERE id = ?",
  ).bind(trip.title, JSON.stringify(trip), now, DEFAULT_ID).run();
  return { updatedAt: now };
}

import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const trips = sqliteTable(
  "trips",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    slug: text("slug").notNull().unique(),
    visibility: text("visibility").notNull().default("private"),
    title: text("title").notNull(),
    snapshot: text("snapshot").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("idx_trips_owner_id").on(table.ownerId)],
);

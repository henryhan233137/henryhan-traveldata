import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const appUsers = sqliteTable("app_users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("member"),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  lastLoginAt: text("last_login_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_auth_sessions_user_id").on(table.userId), index("idx_auth_sessions_expires_at").on(table.expiresAt)],
);

export const passwordResetCodes = sqliteTable(
  "password_reset_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("idx_password_reset_codes_user_id").on(table.userId)],
);

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

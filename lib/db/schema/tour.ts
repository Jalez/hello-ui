import { pgTable, uuid, text, integer, timestamp, index, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Per-user acknowledgment of onboarding tour spot versions (bump version in code to re-show). */
export const userTourSpotAck = pgTable(
  "user_tour_spot_ack",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    spotKey: text("spot_key").notNull(),
    versionSeen: integer("version_seen").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.spotKey] }),
    index("idx_user_tour_spot_ack_user_id").on(table.userId),
  ],
);

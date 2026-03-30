import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/** Per-user LTI 1.0 consumer key/secret pairs (see `app/api/lti/*`). */
export const ltiCredentials = pgTable(
  "lti_credentials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    consumerKey: text("consumer_key").notNull().unique(),
    consumerSecret: text("consumer_secret").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_lti_credentials_consumer_key").on(table.consumerKey),
    index("idx_lti_credentials_user_id").on(table.userId),
  ],
);

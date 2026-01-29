import { pgTable, serial, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: text('telegram_id').unique().notNull(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  username: text('username'),
  languageCode: text('language_code'),
  isPremium: boolean('is_premium').default(false),
  balance: integer('balance').default(0).notNull(),
  lastDailyClaim: timestamp('last_daily_claim'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const globalState = pgTable('global_state', {
  id: serial('id').primaryKey(),
  jackpot: integer('jackpot').default(1000).notNull(), 
});

// NTrack every bet
export const bets = pgTable('bets', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  amount: integer('amount').notNull(), // Amount bet
  roll: integer('roll').notNull(), // Dice result
  isWin: boolean('is_win').notNull(), 
  payout: integer('payout').notNull(), // Amount won (0 if lost)
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  bets: many(bets),
}));

export const betsRelations = relations(bets, ({ one }) => ({
  user: one(users, {
    fields: [bets.userId],
    references: [users.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
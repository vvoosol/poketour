import {sqliteTable,text,integer,primaryKey} from 'drizzle-orm/sqlite-core';
export const saves=sqliteTable('game_saves',{userId:text('user_id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull().default(0),updatedAt:integer('updated_at').notNull()});
export const worldCache=sqliteTable('world_cache',{key:text('key').primaryKey(),value:text('value').notNull(),updatedAt:integer('updated_at').notNull()});
export const gameEvents=sqliteTable('game_events',{userId:text('user_id').notNull(),eventId:integer('event_id').notNull(),event:text('event').notNull(),createdAt:integer('created_at').notNull()},t=>[primaryKey({columns:[t.userId,t.eventId]})]);

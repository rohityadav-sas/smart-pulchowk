import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import ENV from '../config/ENV.js'
import * as authSchema from '../models/auth-schema.js'
import * as eventsSchema from '../models/event-schema.js'
import * as bookBuySellSchema from '../models/book_buy_sell-schema.js'
import * as classroomSchema from '../models/classroom-schema.js'
import * as chatSchema from '../models/chat-schema.js'

const sql = neon(ENV.DATABASE_URL)

export const db = drizzle({
  client: sql,
  schema: { ...authSchema, ...eventsSchema, ...bookBuySellSchema, ...classroomSchema, ...chatSchema },
})

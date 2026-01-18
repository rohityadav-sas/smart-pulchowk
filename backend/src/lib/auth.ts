import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { expo } from '@better-auth/expo'
import { db } from './db.js'
import * as schema from '../models/auth-schema.js'
import ENV from '../config/ENV.js'
import { createAuthMiddleware } from "better-auth/api";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema
	}),
	plugins: [
		expo()
	],
	emailAndPassword: {
		enabled: true
	},
	user: {
		additionalFields: {
			role: {
				type: "string",
				defaultValue: "student"
			}
		}
	},
	socialProviders: {
		google: {
			prompt: "select_account",
			clientId: ENV.GOOGLE_CLIENT_ID,
			clientSecret: ENV.GOOGLE_CLIENT_SECRET,
			// hd: "pcampus.edu.np",
			scope: ['email']
		}
	},
	trustedOrigins: [
		'http://localhost:5173',
		'http://localhost:3000',
		'https://pulchowk-x.vercel.app',
		"pulchowkx://",
		// Expo development URLs
		"exp://",
		"exp://**",
		"exp://192.168.*.*:*/**",
		"exp://10.*.*.*:*/**",
	],
	experimental: {
		joins: true
	},
	hooks: {
		after: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== "/callback/:id") return;
			const session = ctx.context.newSession;
			if (!session?.user?.email?.endsWith("@pcampus.edu.np")) {
				// Delete the session
				await ctx.context.internalAdapter.deleteSession(session.session.token);
				// Redirect to frontend with error
				throw ctx.redirect("/?message=unauthorized_domain");
			}
		})
	}
})

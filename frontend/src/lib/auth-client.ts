import { createAuthClient } from 'better-auth/svelte'
import type { BetterAuthOptions } from '@better-auth/core'

export const authClient = createAuthClient({
  $InferAuth: {
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
        },
      },
    },
  } as BetterAuthOptions,
})

import { z } from 'zod'

export const resourceSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  capacity: z.coerce.number().int().positive().optional().nullable(),
  requires_approval: z.boolean().default(false),
})

export type ResourceInput = z.infer<typeof resourceSchema>
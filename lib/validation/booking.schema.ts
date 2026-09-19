import { z } from 'zod'

export const bookingSchema = z
  .object({
    resource_id: z.string().uuid('Invalid resource'),
    title: z.string().trim().min(1, 'Title is required').max(100),
    start_time: z.string().datetime({ message: 'Invalid start time' }),
    end_time: z.string().datetime({ message: 'Invalid end time' }),
    // 1 = a normal one-off booking. >1 = "repeat weekly for N weeks" —
    // each week becomes its own real row in the bookings table, sharing
    // a recurrence_group_id, NOT a single abstract recurrence rule.
    repeat_weeks: z.coerce.number().int().min(1).max(52).default(1),
  })
  .refine((data) => new Date(data.start_time) < new Date(data.end_time), {
    message: 'End time must be after start time',
    path: ['end_time'],
  })
  .refine((data) => new Date(data.start_time) > new Date(), {
    message: 'Cannot book a time in the past',
    path: ['start_time'],
  })

export type BookingInput = z.infer<typeof bookingSchema>
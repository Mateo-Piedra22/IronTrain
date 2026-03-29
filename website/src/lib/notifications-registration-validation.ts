import { z } from 'zod';

const registrationSchema = z.strictObject({
  pushToken: z.string().trim().min(16).max(4096),
  platform: z.string().trim().min(1).max(32).optional(),
  tokenType: z.string().trim().min(1).max(32).optional(),
});

export type NotificationRegistrationPayload = z.infer<typeof registrationSchema>;

export function parseNotificationRegistrationPayload(payload: unknown): NotificationRegistrationPayload {
  const result = registrationSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? 'Invalid notification registration payload');
  }
  return result.data;
}

import { z } from "zod";

export const notificationSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1, "Title is required"),
    body: z.string().min(1, "Body is required"),
    type: z.enum(["broadcast", "personal", "system"]),
    priority: z.enum(["low", "medium", "high", "critical"]),
    target_user_id: z.string().optional().nullable(),
    is_active: z.boolean().default(true),
    expires_at: z.string().optional().nullable(),
});

export const changelogSchema = z.object({
    id: z.string().optional(),
    version: z.string().min(1, "Version is required"),
    title: z.string().min(1, "Title is required"),
    content: z.string().min(1, "Content is required"),
    type: z.enum(["major", "minor", "patch", "fix"]),
    is_published: z.boolean().default(false),
    items: z.array(z.string()).optional(),
});

export const globalEventSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    multiplier: z.number().default(1),
    starts_at: z.string().min(1, "Start date is required"),
    ends_at: z.string().min(1, "End date is required"),
    is_active: z.boolean().default(true),
});

export const systemStatusSchema = z.object({
    maintenance_mode: z.boolean(),
    offline_only: z.boolean(),
    min_app_version: z.string().optional(),
    motd: z.string().optional(),
});

export const socialScoringSchema = z.object({
    action: z.string(),
    points: z.number(),
    cooldown_minutes: z.number().default(0),
    daily_limit: z.number().optional().nullable(),
});

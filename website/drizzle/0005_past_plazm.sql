ALTER TABLE "shares_inbox" ALTER COLUMN "payload" TYPE jsonb USING payload::jsonb;
DROP TABLE "admin_notifications" CASCADE;
DROP TABLE "feedback" CASCADE;
DROP TABLE "notification_logs" CASCADE;
DROP TABLE "notification_reactions" CASCADE;
DROP TABLE "system_status" CASCADE;
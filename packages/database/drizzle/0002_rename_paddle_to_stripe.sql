ALTER TABLE "subscriptions" RENAME COLUMN "paddle_subscription_id" TO "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "subscriptions" RENAME COLUMN "paddle_customer_id" TO "stripe_customer_id";--> statement-breakpoint
ALTER TABLE "subscriptions" RENAME CONSTRAINT "subscriptions_paddle_subscription_id_unique" TO "subscriptions_stripe_subscription_id_unique";

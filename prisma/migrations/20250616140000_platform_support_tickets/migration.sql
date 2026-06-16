CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED');
CREATE TYPE "SupportTicketCategory" AS ENUM ('BILLING', 'COMPLIANCE', 'TECHNICAL', 'DISPUTE', 'ACCOUNT', 'OTHER');
CREATE TYPE "SupportTicketReporterType" AS ENUM ('LENDER', 'BORROWER');

CREATE TABLE "platform_support_tickets" (
    "id" UUID NOT NULL,
    "ticket_number" SERIAL NOT NULL,
    "reporter_user_id" UUID NOT NULL,
    "reporter_type" "SupportTicketReporterType" NOT NULL,
    "org_id" UUID,
    "category" "SupportTicketCategory" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_user_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_support_tickets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_support_ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_support_ticket_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_support_tickets_ticket_number_key" ON "platform_support_tickets"("ticket_number");
CREATE INDEX "platform_support_tickets_status_created_at_idx" ON "platform_support_tickets"("status", "created_at");
CREATE INDEX "platform_support_tickets_reporter_user_id_idx" ON "platform_support_tickets"("reporter_user_id");
CREATE INDEX "platform_support_tickets_org_id_idx" ON "platform_support_tickets"("org_id");
CREATE INDEX "platform_support_ticket_messages_ticket_id_created_at_idx" ON "platform_support_ticket_messages"("ticket_id", "created_at");

ALTER TABLE "platform_support_tickets" ADD CONSTRAINT "platform_support_tickets_reporter_user_id_fkey"
  FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_support_tickets" ADD CONSTRAINT "platform_support_tickets_org_id_fkey"
  FOREIGN KEY ("org_id") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_support_tickets" ADD CONSTRAINT "platform_support_tickets_assigned_to_user_id_fkey"
  FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "platform_support_ticket_messages" ADD CONSTRAINT "platform_support_ticket_messages_ticket_id_fkey"
  FOREIGN KEY ("ticket_id") REFERENCES "platform_support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_support_ticket_messages" ADD CONSTRAINT "platform_support_ticket_messages_author_user_id_fkey"
  FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_support_tickets" FORCE ROW LEVEL SECURITY;

ALTER TABLE "platform_support_ticket_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_support_ticket_messages" FORCE ROW LEVEL SECURITY;

CREATE POLICY "platform_support_tickets_reporter_select" ON "platform_support_tickets"
  FOR SELECT USING (reporter_user_id = app_current_user_id());

CREATE POLICY "platform_support_tickets_reporter_insert" ON "platform_support_tickets"
  FOR INSERT WITH CHECK (reporter_user_id = app_current_user_id());

CREATE POLICY "platform_support_ticket_messages_reporter_select" ON "platform_support_ticket_messages"
  FOR SELECT USING (
    is_internal = false
    AND EXISTS (
      SELECT 1 FROM platform_support_tickets t
      WHERE t.id = ticket_id AND t.reporter_user_id = app_current_user_id()
    )
  );

CREATE POLICY "platform_support_ticket_messages_reporter_insert" ON "platform_support_ticket_messages"
  FOR INSERT WITH CHECK (
    is_internal = false
    AND author_user_id = app_current_user_id()
    AND EXISTS (
      SELECT 1 FROM platform_support_tickets t
      WHERE t.id = ticket_id AND t.reporter_user_id = app_current_user_id()
    )
  );

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

const INTERACTIVE_TX_OPTIONS = { timeout: 15_000, maxWait: 10_000 } as const;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Supabase transaction pooler (:6543, pgbouncer=true) does not support Prisma
   * interactive transactions. Use DIRECT_URL (session pooler :5432) for RLS-scoped work.
   */
  private readonly interactiveClient: PrismaClient;

  constructor() {
    super();
    const directUrl = process.env.DIRECT_URL;
    const databaseUrl = process.env.DATABASE_URL;
    this.interactiveClient =
      directUrl && directUrl !== databaseUrl
        ? new PrismaClient({ datasources: { db: { url: directUrl } } })
        : this;
  }

  async onModuleInit() {
    await this.$connect();
    if (this.interactiveClient !== this) {
      await this.interactiveClient.$connect();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    if (this.interactiveClient !== this) {
      await this.interactiveClient.$disconnect();
    }
  }

  async setSessionContext(
    tx: PrismaTx,
    context: {
      orgId?: string;
      userId?: string;
      authLookup?: boolean;
      tokenLookup?: boolean;
    },
  ) {
    if (context.orgId) {
      await tx.$executeRaw`SELECT set_config('app.current_org_id', ${context.orgId}, true)`;
    }
    if (context.userId) {
      await tx.$executeRaw`SELECT set_config('app.current_user_id', ${context.userId}, true)`;
    }
    if (context.authLookup) {
      await tx.$executeRaw`SELECT set_config('app.auth_lookup', 'true', true)`;
    }
    if (context.tokenLookup) {
      await tx.$executeRaw`SELECT set_config('app.token_lookup', 'true', true)`;
    }
  }

  async clearSessionContext(tx: PrismaTx) {
    await tx.$executeRaw`SELECT set_config('app.current_org_id', '', true)`;
    await tx.$executeRaw`SELECT set_config('app.current_user_id', '', true)`;
    await tx.$executeRaw`SELECT set_config('app.auth_lookup', '', true)`;
    await tx.$executeRaw`SELECT set_config('app.token_lookup', '', true)`;
  }

  async withOrgContext<T>(
    orgId: string,
    userId: string,
    fn: (tx: PrismaTx) => Promise<T>,
  ): Promise<T> {
    return this.interactiveClient.$transaction(async (tx) => {
      await this.setSessionContext(tx, { orgId, userId });
      return fn(tx);
    }, INTERACTIVE_TX_OPTIONS);
  }

  async withUserContext<T>(
    userId: string,
    orgId: string | null | undefined,
    fn: (tx: PrismaTx) => Promise<T>,
  ): Promise<T> {
    return this.interactiveClient.$transaction(async (tx) => {
      await this.setSessionContext(tx, {
        userId,
        ...(orgId ? { orgId } : {}),
      });
      return fn(tx);
    }, INTERACTIVE_TX_OPTIONS);
  }

  async withAuthLookup<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    return this.interactiveClient.$transaction(async (tx) => {
      await this.setSessionContext(tx, { authLookup: true, tokenLookup: true });
      return fn(tx);
    }, INTERACTIVE_TX_OPTIONS);
  }
}

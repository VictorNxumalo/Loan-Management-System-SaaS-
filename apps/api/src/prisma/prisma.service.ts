import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
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
    return this.$transaction(async (tx) => {
      await this.setSessionContext(tx, { orgId, userId });
      return fn(tx);
    });
  }

  async withAuthLookup<T>(fn: (tx: PrismaTx) => Promise<T>): Promise<T> {
    return this.$transaction(async (tx) => {
      await this.setSessionContext(tx, { authLookup: true, tokenLookup: true });
      return fn(tx);
    });
  }
}

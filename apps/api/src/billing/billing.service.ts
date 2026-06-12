import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  BillingPortalDto,
  BillingStatusDto,
  CheckoutSessionDto,
  CreateCheckoutSessionInput,
} from '@lms/types';
import {
  LoanStatus,
  OrganisationPlan,
  PLAN_LIMITS,
  PlanStatus,
  SubscriptionStatus,
} from '@lms/types';
import Stripe from 'stripe';
import type { Session as StripeCheckoutSession } from 'stripe/cjs/resources/Checkout/Sessions.js';
import type { Event as StripeEvent } from 'stripe/cjs/resources/Events.js';
import type { Subscription as StripeSubscription } from 'stripe/cjs/resources/Subscriptions.js';
import { getEnv, isStripeConfigured } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { computeTrialEndsAt } from './trial.util';

type StripeClient = Stripe.Stripe;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: StripeClient | null = null;

  constructor(private readonly prisma: PrismaService) {
    const env = getEnv();
    if (env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(env.STRIPE_SECRET_KEY);
    }
  }

  /** Sync trial expiry → READ_ONLY; call before status checks and write guards. */
  async syncPlanStatus(orgId: string, userId: string): Promise<void> {
    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });

      if (org.planStatus !== PlanStatus.TRIAL || !org.trialEndsAt) {
        return;
      }

      if (org.trialEndsAt < new Date()) {
        await tx.organisation.update({
          where: { id: orgId },
          data: { planStatus: PlanStatus.READ_ONLY },
        });
        this.logger.log(`Organisation ${orgId} trial expired → READ_ONLY`);
      }
    });
  }

  async assertWritable(orgId: string, userId: string): Promise<void> {
    await this.syncPlanStatus(orgId, userId);

    const org = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.organisation.findFirstOrThrow({ where: { id: orgId } }),
    );

    if (
      org.planStatus === PlanStatus.READ_ONLY ||
      org.planStatus === PlanStatus.CANCELLED
    ) {
      throw new ForbiddenException(
        'Your workspace is read-only. Subscribe to a plan on the Billing page to continue making changes.',
      );
    }
  }

  async getStatus(orgId: string, userId: string): Promise<BillingStatusDto> {
    await this.syncPlanStatus(orgId, userId);

    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      const subscription = await tx.subscription.findFirst({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
      });

      const [activeLoans, users] = await Promise.all([
        tx.loan.count({
          where: {
            orgId,
            deletedAt: null,
            status: { in: [LoanStatus.ACTIVE, LoanStatus.IN_ARREARS] },
          },
        }),
        tx.user.count({ where: { orgId, deletedAt: null, isActive: true } }),
      ]);

      const limits =
        PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[OrganisationPlan.STARTER]!;
      const trialDaysRemaining =
        org.planStatus === PlanStatus.TRIAL && org.trialEndsAt
          ? Math.max(
              0,
              Math.ceil(
                (org.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
              ),
            )
          : null;

      return {
        plan: org.plan,
        planStatus: org.planStatus,
        planLabel: limits.label,
        trialEndsAt: org.trialEndsAt?.toISOString() ?? null,
        trialDaysRemaining,
        isReadOnly:
          org.planStatus === PlanStatus.READ_ONLY ||
          org.planStatus === PlanStatus.CANCELLED,
        isStripeConfigured: isStripeConfigured(),
        currentPeriodEnd: subscription?.currentPeriodEnd.toISOString() ?? null,
        subscriptionStatus: subscription?.status ?? null,
        limits: {
          maxActiveLoans: limits.maxActiveLoans,
          maxUsers: limits.maxUsers,
          activeLoans,
          users,
        },
      };
    });
  }

  async createCheckoutSession(
    orgId: string,
    userId: string,
    adminEmail: string,
    input: CreateCheckoutSessionInput,
  ): Promise<CheckoutSessionDto> {
    if (!this.stripe || !isStripeConfigured()) {
      throw new BadRequestException(
        'Stripe billing is not configured. Add STRIPE_SECRET_KEY and price IDs to .env.',
      );
    }

    const env = getEnv();
    const priceId = this.priceIdForPlan(input.plan);
    const customerId = await this.ensureStripeCustomer(orgId, userId, adminEmail);

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.NEXTAUTH_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${env.NEXTAUTH_URL}/dashboard/billing?checkout=cancelled`,
      metadata: { orgId, plan: input.plan },
      subscription_data: {
        metadata: { orgId, plan: input.plan },
      },
    });

    if (!session.url) {
      throw new BadRequestException('Could not create checkout session');
    }

    return { url: session.url };
  }

  async createPortalSession(
    orgId: string,
    userId: string,
  ): Promise<BillingPortalDto> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe billing is not configured');
    }

    const env = getEnv();
    const org = await this.prisma.withOrgContext(orgId, userId, async (tx) =>
      tx.organisation.findFirstOrThrow({ where: { id: orgId } }),
    );

    if (!org.stripeCustomerId) {
      throw new BadRequestException(
        'No billing account yet. Subscribe to a plan first.',
      );
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: `${env.NEXTAUTH_URL}/dashboard/billing`,
    });

    return { url: session.url };
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    if (!this.stripe) {
      throw new BadRequestException('Stripe not configured');
    }

    const env = getEnv();
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET not configured');
    }

    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      this.logger.warn(
        `Webhook signature verification failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as StripeCheckoutSession);
        break;
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        await this.onSubscriptionUpdated(event.data.object as StripeSubscription);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as StripeSubscription);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }
  }

  static trialEndsAtFromNow(): Date {
    return computeTrialEndsAt();
  }

  private priceIdForPlan(plan: string): string {
    const env = getEnv();
    const map: Record<string, string | undefined> = {
      [OrganisationPlan.STARTER]: env.STRIPE_PRICE_STARTER,
      [OrganisationPlan.PRO]: env.STRIPE_PRICE_PRO,
      [OrganisationPlan.BUSINESS]: env.STRIPE_PRICE_BUSINESS,
    };
    const priceId = map[plan];
    if (!priceId) {
      throw new BadRequestException(`No Stripe price configured for plan ${plan}`);
    }
    return priceId;
  }

  private async ensureStripeCustomer(
    orgId: string,
    userId: string,
    email: string,
  ): Promise<string> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      if (org.stripeCustomerId) {
        return org.stripeCustomerId;
      }

      if (!this.stripe) {
        throw new BadRequestException('Stripe not configured');
      }

      const customer = await this.stripe.customers.create({
        email,
        metadata: { orgId },
      });

      await tx.organisation.update({
        where: { id: orgId },
        data: { stripeCustomerId: customer.id },
      });

      return customer.id;
    });
  }

  async assertActiveLoanCapacity(orgId: string, userId: string): Promise<void> {
    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      const limits =
        PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[OrganisationPlan.STARTER]!;

      if (limits.maxActiveLoans == null) {
        return;
      }

      const activeLoans = await tx.loan.count({
        where: {
          orgId,
          deletedAt: null,
          status: { in: [LoanStatus.ACTIVE, LoanStatus.IN_ARREARS] },
        },
      });

      if (activeLoans >= limits.maxActiveLoans) {
        throw new ForbiddenException(
          `Your ${limits.label} plan allows up to ${limits.maxActiveLoans} active loans. Upgrade on the Billing page to add more.`,
        );
      }
    });
  }

  async assertTeamMemberCapacity(orgId: string, userId: string): Promise<void> {
    await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      const limits =
        PLAN_LIMITS[org.plan] ?? PLAN_LIMITS[OrganisationPlan.STARTER]!;

      if (limits.maxUsers == null) {
        return;
      }

      const [users, pendingInvites] = await Promise.all([
        tx.user.count({ where: { orgId, deletedAt: null, isActive: true } }),
        tx.teamInvite.count({
          where: {
            orgId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
      ]);

      if (users + pendingInvites >= limits.maxUsers) {
        throw new ForbiddenException(
          `Your ${limits.label} plan allows up to ${limits.maxUsers} team member(s). Upgrade on the Billing page to invite more.`,
        );
      }
    });
  }

  private async onCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
    const orgId = session.metadata?.orgId;
    if (!orgId || session.mode !== 'subscription') {
      return;
    }

    this.logger.log(`Checkout completed for org ${orgId}`);
  }

  private async onSubscriptionUpdated(subscription: StripeSubscription): Promise<void> {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) {
      this.logger.warn(`Subscription ${subscription.id} missing orgId metadata`);
      return;
    }

    const plan =
      (subscription.metadata?.plan as typeof OrganisationPlan.STARTER) ??
      OrganisationPlan.STARTER;
    const status = this.mapSubscriptionStatus(subscription.status);
    const periodEnd = this.subscriptionPeriodEnd(subscription);

    await this.prisma.$transaction(async (tx) => {
      await this.prisma.setSessionContext(tx, { orgId });

      await tx.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        create: {
          orgId,
          stripeSubscriptionId: subscription.id,
          plan,
          status,
          currentPeriodEnd: periodEnd,
        },
        update: {
          plan,
          status,
          currentPeriodEnd: periodEnd,
        },
      });

      const planStatus = this.orgPlanStatusFromSubscription(subscription.status);
      await tx.organisation.update({
        where: { id: orgId },
        data: { plan, planStatus },
      });
    });

    this.logger.log(`Synced subscription ${subscription.id} for org ${orgId} → ${status}`);
  }

  private async onSubscriptionDeleted(subscription: StripeSubscription): Promise<void> {
    const orgId = subscription.metadata?.orgId;
    if (!orgId) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await this.prisma.setSessionContext(tx, { orgId });

      await tx.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: SubscriptionStatus.CANCELED },
      });

      await tx.organisation.update({
        where: { id: orgId },
        data: { planStatus: PlanStatus.READ_ONLY },
      });
    });

    this.logger.log(`Subscription deleted for org ${orgId} → READ_ONLY`);
  }

  private subscriptionPeriodEnd(subscription: StripeSubscription): Date {
    const itemEnd = subscription.items?.data?.[0]?.current_period_end;
    if (itemEnd) {
      return new Date(itemEnd * 1000);
    }

    const legacyEnd = (subscription as { current_period_end?: number }).current_period_end;
    if (legacyEnd) {
      return new Date(legacyEnd * 1000);
    }

    throw new BadRequestException(
      `Subscription ${subscription.id} is missing a billing period end`,
    );
  }

  private mapSubscriptionStatus(stripeStatus: StripeSubscription['status']): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      default:
        return SubscriptionStatus.ACTIVE;
    }
  }

  private orgPlanStatusFromSubscription(
    stripeStatus: StripeSubscription['status'],
  ): PlanStatus {
    switch (stripeStatus) {
      case 'active':
      case 'trialing':
        return PlanStatus.ACTIVE;
      case 'past_due':
        return PlanStatus.PAST_DUE;
      case 'canceled':
      case 'unpaid':
        return PlanStatus.READ_ONLY;
      default:
        return PlanStatus.ACTIVE;
    }
  }
}

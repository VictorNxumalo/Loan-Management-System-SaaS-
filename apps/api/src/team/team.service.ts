import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SendTeamInviteInput, TeamListDto } from '@lms/types';
import { INVITABLE_ROLE_LABELS, UserRole } from '@lms/types';
import { AuditService } from '../audit/audit.service';
import { TokenService } from '../auth/token.service';
import { EmailService } from '../email/email.service';
import { getEnv } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const INVITE_EXPIRY_DAYS = 14;

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  async listTeam(orgId: string, userId: string): Promise<TeamListDto> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const [members, invites] = await Promise.all([
        tx.user.findMany({
          where: { orgId, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        }),
        tx.teamInvite.findMany({
          where: {
            orgId,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          include: { invitedBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return {
        members: members.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          isActive: member.isActive,
          isSelf: member.id === userId,
          joinedAt: member.createdAt.toISOString(),
        })),
        pendingInvites: invites.map((invite) => ({
          id: invite.id,
          email: invite.email,
          role: invite.role,
          invitedByName: invite.invitedBy.name,
          expiresAt: invite.expiresAt.toISOString(),
          createdAt: invite.createdAt.toISOString(),
        })),
      };
    });
  }

  async sendInvite(
    orgId: string,
    userId: string,
    input: SendTeamInviteInput,
  ): Promise<{ message: string }> {
    const email = input.email.toLowerCase();

    const existingUser = await this.prisma.withAuthLookup(async (tx) =>
      tx.user.findFirst({ where: { email, deletedAt: null } }),
    );
    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists. Team invites are for new staff accounts.',
      );
    }

    const { token, hash } = this.tokenService.generateOpaqueToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRY_DAYS);

    const org = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const pending = await tx.teamInvite.findFirst({
        where: {
          orgId,
          email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (pending) {
        throw new ConflictException('A pending invite already exists for this email');
      }

      const invite = await tx.teamInvite.create({
        data: {
          orgId,
          email,
          role: input.role,
          tokenHash: hash,
          invitedByUserId: userId,
          expiresAt,
        },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'team.invite_sent',
        entityType: 'TEAM_INVITE',
        entityId: invite.id,
        after: { email, role: input.role },
      });

      return tx.organisation.findFirstOrThrow({ where: { id: orgId } });
    });

    const link = `${getEnv().NEXTAUTH_URL}/auth/register?invite=${token}`;
    await this.emailService.sendTeamInviteEmail(
      email,
      org.name,
      INVITABLE_ROLE_LABELS[input.role] ?? input.role,
      link,
    );

    return { message: `Invite sent to ${email}` };
  }

  async revokeInvite(
    orgId: string,
    userId: string,
    inviteId: string,
  ): Promise<{ message: string }> {
    return this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const invite = await tx.teamInvite.findFirst({
        where: { id: inviteId, orgId, acceptedAt: null, revokedAt: null },
      });
      if (!invite) {
        throw new NotFoundException('Invite not found');
      }

      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { revokedAt: new Date() },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'team.invite_revoked',
        entityType: 'TEAM_INVITE',
        entityId: invite.id,
        before: { email: invite.email, role: invite.role },
      });

      return { message: `Invite to ${invite.email} revoked` };
    });
  }

  async removeMember(
    orgId: string,
    userId: string,
    memberId: string,
  ): Promise<{ message: string }> {
    if (memberId === userId) {
      throw new BadRequestException('You cannot remove your own account');
    }

    const removed = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const member = await tx.user.findFirst({
        where: { id: memberId, orgId, deletedAt: null },
      });
      if (!member || !member.isActive) {
        throw new NotFoundException('Team member not found');
      }

      if (member.role === UserRole.ADMIN) {
        const otherAdmins = await tx.user.count({
          where: {
            orgId,
            role: UserRole.ADMIN,
            isActive: true,
            deletedAt: null,
            id: { not: memberId },
          },
        });
        if (otherAdmins === 0) {
          throw new BadRequestException('Cannot remove the last active admin');
        }
      }

      await tx.user.update({
        where: { id: memberId },
        data: { isActive: false },
      });

      await this.auditService.record(tx, {
        orgId,
        userId,
        action: 'team.member_removed',
        entityType: 'USER',
        entityId: memberId,
        before: { name: member.name, email: member.email, role: member.role, isActive: true },
        after: { isActive: false },
      });

      return member;
    });

    // Invalidate the removed member's sessions (token tables allow lookup mode).
    await this.prisma.withAuthLookup(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId: memberId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    return { message: `${removed.name} no longer has access` };
  }
}

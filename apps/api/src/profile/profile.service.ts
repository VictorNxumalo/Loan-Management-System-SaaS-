import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthMeResponse,
  BorrowerOnboardingInput,
  KycDocumentDownloadUrlDto,
  KycDocumentUploadUrlDto,
  LenderOnboardingInput,
  RequestKycDocumentUploadInput,
  UpdateProfileInput,
  UserProfileDto,
} from '@lms/types';
import {
  AccountType,
  UserKycDocumentType,
  USER_KYC_DOCUMENT_LABELS,
  WalletOwnerType,
} from '@lms/types';
import { Prisma } from '@prisma/client';
import {
  assertLogoPathForOrg,
  getOrganisationLogoStoragePath,
} from '../common/organisation-logo.util';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { maskAccountNumber } from '../wallets/wallet.util';
import { WalletsService } from '../wallets/wallets.service';
import {
  assertUserKycDocumentPath,
  assertValidKycUpload,
  buildUserKycDocumentPath,
} from './profile.util';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: SupabaseStorageService,
    private readonly walletsService: WalletsService,
  ) {}

  async getProfile(
    userId: string,
    accountType: string,
    orgId?: string,
  ): Promise<UserProfileDto> {
    if (accountType === AccountType.BORROWER) {
      return this.prisma.withUserContext(userId, null, async (tx) =>
        this.buildProfileDto(tx, userId, accountType),
      );
    }

    return this.prisma.withOrgContext(orgId!, userId, async (tx) =>
      this.buildProfileDto(tx, userId, accountType, orgId),
    );
  }

  async updateProfile(
    userId: string,
    accountType: string,
    orgId: string | undefined,
    input: UpdateProfileInput,
  ): Promise<UserProfileDto> {
    if (accountType === AccountType.BORROWER) {
      return this.prisma.withUserContext(userId, null, async (tx) => {
        await this.applyProfileUpdates(tx, userId, accountType, orgId, input);
        return this.buildProfileDto(tx, userId, accountType);
      });
    }

    return this.prisma.withOrgContext(orgId!, userId, async (tx) => {
      await this.applyProfileUpdates(tx, userId, accountType, orgId, input);
      return this.buildProfileDto(tx, userId, accountType);
    });
  }

  async completeLenderOnboarding(
    userId: string,
    orgId: string,
    input: LenderOnboardingInput,
  ): Promise<AuthMeResponse> {
    const user = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      await this.assertIdDocumentExists(tx, userId);

      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });
      const current = (org.settings as Record<string, unknown>) ?? {};
      const nextSettings: Record<string, unknown> = {
        ...current,
        defaultCurrency: input.defaultCurrency,
        defaultInterestType: input.defaultInterestType,
        publicListing: current.publicListing ?? true,
      };

      if (input.logoStoragePath) {
        assertLogoPathForOrg(orgId, input.logoStoragePath);
        const previousLogo = getOrganisationLogoStoragePath(current);
        nextSettings.logoStoragePath = input.logoStoragePath;
        if (previousLogo && previousLogo !== input.logoStoragePath) {
          void this.storage.removeObject(previousLogo);
        }
      }

      await tx.organisation.update({
        where: { id: orgId },
        data: {
          name: input.organisationName,
          settings: nextSettings as Prisma.InputJsonValue,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          idNumber: input.idNumber.trim(),
          address: input.address.trim(),
        },
      });

      const wallet = await this.walletsService.getOrCreateOrgWallet(tx, orgId);
      await this.walletsService.upsertOrgBankAccountInTx(
        tx,
        orgId,
        userId,
        wallet.id,
        input.bankDetails,
      );

      await tx.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
      });

      return tx.user.findFirstOrThrow({
        where: { id: userId },
        include: {
          organisation: { include: { wallet: { include: { bankAccount: true } } } },
          kycDocuments: true,
        },
      });
    });

    return this.mapMe(user);
  }

  async completeBorrowerOnboarding(
    userId: string,
    input: BorrowerOnboardingInput,
  ): Promise<AuthMeResponse> {
    const user = await this.prisma.withUserContext(userId, null, async (tx) => {
      await this.assertIdDocumentExists(tx, userId);

      await tx.borrowerAccount.upsert({
        where: { userId },
        create: {
          userId,
          phone: input.phone.trim(),
          idNumber: input.idNumber.trim(),
        },
        update: {
          phone: input.phone.trim(),
          idNumber: input.idNumber.trim(),
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          idNumber: input.idNumber.trim(),
          address: input.address.trim(),
        },
      });

      const wallet = await this.walletsService.getOrCreateBorrowerWallet(tx, userId);
      await this.walletsService.upsertBorrowerBankAccountInTx(
        tx,
        wallet.id,
        input.bankDetails,
      );

      return tx.user.update({
        where: { id: userId },
        data: { onboardingCompletedAt: new Date() },
        include: {
          borrowerAccount: true,
          kycDocuments: true,
          wallet: { include: { bankAccount: true } },
        },
      });
    });

    return this.mapMe(user);
  }

  async requestIdDocumentUploadUrl(
    userId: string,
    accountType: string,
    orgId: string | undefined,
    input: RequestKycDocumentUploadInput,
  ): Promise<KycDocumentUploadUrlDto> {
    try {
      assertValidKycUpload(input.contentType, input.sizeBytes);
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid upload',
      );
    }

    const storagePath = buildUserKycDocumentPath(
      userId,
      input.documentType,
      input.filename,
    );

    const run = async (tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0]) => {
      const existing = await tx.userKycDocument.findUnique({
        where: {
          userId_documentType: {
            userId,
            documentType: input.documentType,
          },
        },
      });

      if (existing) {
        void this.storage.removeObject(existing.storagePath);
      }

      await tx.userKycDocument.upsert({
        where: {
          userId_documentType: {
            userId,
            documentType: input.documentType,
          },
        },
        create: {
          userId,
          documentType: input.documentType,
          storagePath,
          originalFilename: input.filename,
          contentType: input.contentType,
        },
        update: {
          storagePath,
          originalFilename: input.filename,
          contentType: input.contentType,
        },
      });
    };

    if (accountType === AccountType.BORROWER) {
      await this.prisma.withUserContext(userId, null, run);
    } else {
      await this.prisma.withOrgContext(orgId!, userId, run);
    }

    const signed = await this.storage.createSignedUploadUrl(storagePath);

    return {
      uploadUrl: signed.signedUrl,
      storagePath,
      expiresInSeconds: this.storage.expirySeconds,
    };
  }

  async getIdDocumentDownloadUrl(
    userId: string,
    accountType: string,
    orgId: string | undefined,
  ): Promise<KycDocumentDownloadUrlDto> {
    const load = async (tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0]) => {
      const doc = await tx.userKycDocument.findUnique({
        where: {
          userId_documentType: {
            userId,
            documentType: UserKycDocumentType.ID_COPY,
          },
        },
      });

      if (!doc) {
        throw new NotFoundException('ID document not uploaded');
      }

      return doc;
    };

    const doc =
      accountType === AccountType.BORROWER
        ? await this.prisma.withUserContext(userId, null, load)
        : await this.prisma.withOrgContext(orgId!, userId, load);

    const downloadUrl = await this.storage.createSignedDownloadUrl(doc.storagePath);

    return {
      downloadUrl,
      expiresInSeconds: this.storage.expirySeconds,
      originalFilename: doc.originalFilename,
    };
  }

  async computeProfileComplete(
    tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0],
    userId: string,
    accountType: string,
    orgId?: string,
  ): Promise<{ complete: boolean; missing: string[] }> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        borrowerAccount: true,
        kycDocuments: true,
        wallet: { include: { bankAccount: true } },
      },
    });

    if (!user) {
      return { complete: false, missing: ['Account not found'] };
    }

    const missing: string[] = [];

    if (!user.idNumber?.trim()) {
      missing.push('SA ID number');
    }
    if (!user.address?.trim()) {
      missing.push('Physical address');
    }
    if (accountType === AccountType.BORROWER && !user.borrowerAccount?.phone?.trim()) {
      missing.push('Phone number');
    }

    const hasBank = await this.hasLinkedBankAccount(tx, accountType, orgId, user);
    if (!hasBank) {
      missing.push('Bank account linked to wallet');
    }

    const hasIdDoc = user.kycDocuments.some(
      (d) => d.documentType === UserKycDocumentType.ID_COPY,
    );
    if (!hasIdDoc) {
      missing.push(USER_KYC_DOCUMENT_LABELS[UserKycDocumentType.ID_COPY]);
    }

    return { complete: missing.length === 0, missing };
  }

  mapMe(user: {
    id: string;
    email: string;
    name: string;
    accountType: string;
    role: string | null;
    emailVerifiedAt: Date | null;
    onboardingCompletedAt: Date | null;
    idNumber: string | null;
    address: string | null;
    organisation?: {
      id: string;
      name: string;
      plan: string;
      planStatus: string;
      settings: unknown;
      wallet?: { bankAccount: unknown | null } | null;
    } | null;
    borrowerAccount?: {
      phone: string;
      idNumber: string | null;
    } | null;
    kycDocuments?: { documentType: string }[];
    wallet?: { bankAccount: unknown | null } | null;
  }): AuthMeResponse {
    const missing: string[] = [];
    if (!user.idNumber?.trim()) missing.push('SA ID number');
    if (!user.address?.trim()) missing.push('Physical address');
    if (user.accountType === AccountType.BORROWER && !user.borrowerAccount?.phone?.trim()) {
      missing.push('Phone number');
    }

    const bankLinked = this.isBankAccountLinked(user);
    if (!bankLinked) missing.push('Bank account');

    const hasIdDoc = (user.kycDocuments ?? []).some(
      (d) => d.documentType === UserKycDocumentType.ID_COPY,
    );
    if (!hasIdDoc) missing.push('ID document');

    const profileComplete = missing.length === 0;

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        role: user.role,
        emailVerified: Boolean(user.emailVerifiedAt),
        onboardingCompleted: Boolean(user.onboardingCompletedAt) && profileComplete,
        profileComplete,
      },
      ...(user.organisation
        ? {
            organisation: {
              id: user.organisation.id,
              name: user.organisation.name,
              plan: user.organisation.plan,
              planStatus: user.organisation.planStatus,
              settings: (user.organisation.settings as Record<string, unknown>) ?? {},
            },
          }
        : {}),
      ...(user.borrowerAccount
        ? {
            borrowerProfile: {
              phone: user.borrowerAccount.phone,
              idNumber: user.idNumber ?? user.borrowerAccount.idNumber,
              address: user.address,
            },
          }
        : {}),
    };
  }

  private async buildProfileDto(
    tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0],
    userId: string,
    accountType: string,
    orgId?: string,
  ): Promise<UserProfileDto> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: {
        borrowerAccount: true,
        kycDocuments: true,
        wallet: { include: { bankAccount: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { complete, missing } = await this.computeProfileComplete(
      tx,
      userId,
      accountType,
      orgId,
    );

    const idDoc = user.kycDocuments.find(
      (d) => d.documentType === UserKycDocumentType.ID_COPY,
    );

    const bankAccountRecord = await this.loadBankAccountRecord(
      tx,
      accountType,
      orgId,
      user,
    );

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      accountType: user.accountType,
      idNumber: user.idNumber,
      address: user.address,
      phone: user.borrowerAccount?.phone ?? null,
      bankAccount: bankAccountRecord
        ? {
            accountHolder: bankAccountRecord.accountHolder,
            bankName: bankAccountRecord.bankName,
            branchCode: bankAccountRecord.branchCode,
            accountNumberMasked: maskAccountNumber(bankAccountRecord.accountNumber),
          }
        : null,
      idDocument: idDoc
        ? {
            documentType: idDoc.documentType,
            documentTypeLabel:
              USER_KYC_DOCUMENT_LABELS[idDoc.documentType as UserKycDocumentType] ??
              idDoc.documentType,
            originalFilename: idDoc.originalFilename,
            uploadedAt: idDoc.createdAt.toISOString(),
          }
        : null,
      profileComplete: complete,
      missingRequirements: missing,
    };
  }

  private async applyProfileUpdates(
    tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0],
    userId: string,
    accountType: string,
    orgId: string | undefined,
    input: UpdateProfileInput,
  ): Promise<void> {
    if (input.idNumber !== undefined || input.address !== undefined) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.idNumber !== undefined ? { idNumber: input.idNumber.trim() } : {}),
          ...(input.address !== undefined ? { address: input.address.trim() } : {}),
        },
      });
    }

    if (input.phone !== undefined && accountType === AccountType.BORROWER) {
      await tx.borrowerAccount.upsert({
        where: { userId },
        create: {
          userId,
          phone: input.phone.trim(),
          idNumber: input.idNumber?.trim() ?? null,
        },
        update: {
          phone: input.phone.trim(),
          ...(input.idNumber !== undefined ? { idNumber: input.idNumber.trim() } : {}),
        },
      });
    }

    if (input.bankDetails) {
      if (accountType === AccountType.BORROWER) {
        const wallet = await this.walletsService.getOrCreateBorrowerWallet(tx, userId);
        await this.walletsService.upsertBorrowerBankAccountInTx(
          tx,
          wallet.id,
          input.bankDetails,
        );
      } else if (orgId) {
        const wallet = await this.walletsService.getOrCreateOrgWallet(tx, orgId);
        await this.walletsService.upsertOrgBankAccountInTx(
          tx,
          orgId,
          userId,
          wallet.id,
          input.bankDetails,
        );
      }
    }
  }

  private async assertIdDocumentExists(
    tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0],
    userId: string,
  ): Promise<void> {
    const doc = await tx.userKycDocument.findUnique({
      where: {
        userId_documentType: {
          userId,
          documentType: UserKycDocumentType.ID_COPY,
        },
      },
    });

    if (!doc) {
      throw new BadRequestException(
        'Upload your SA ID document (coloured copy) before completing onboarding',
      );
    }

    assertUserKycDocumentPath(userId, doc.storagePath);
  }

  /** Lender wallets belong to the org; borrower wallets belong to the user. */
  private isBankAccountLinked(user: {
    accountType: string;
    organisation?: { wallet?: { bankAccount: unknown | null } | null } | null;
    wallet?: { bankAccount: unknown | null } | null;
  }): boolean {
    if (user.accountType === AccountType.LENDER) {
      return Boolean(user.organisation?.wallet?.bankAccount);
    }
    return Boolean(user.wallet?.bankAccount);
  }

  private async loadBankAccountRecord(
    tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0],
    accountType: string,
    orgId: string | undefined,
    user: { wallet?: { bankAccount: {
      accountHolder: string;
      bankName: string;
      branchCode: string;
      accountNumber: string;
    } | null } | null },
  ) {
    if (accountType === AccountType.LENDER && orgId) {
      const orgWallet = await tx.wallet.findFirst({
        where: { ownerType: WalletOwnerType.ORGANISATION, ownerOrgId: orgId },
        include: { bankAccount: true },
      });
      return orgWallet?.bankAccount ?? null;
    }
    return user.wallet?.bankAccount ?? null;
  }

  private async hasLinkedBankAccount(
    tx: Parameters<Parameters<PrismaService['withUserContext']>[2]>[0],
    accountType: string,
    orgId: string | undefined,
    user: { wallet?: { bankAccount: unknown | null } | null },
  ): Promise<boolean> {
    if (accountType === AccountType.LENDER) {
      if (!orgId) return false;
      const orgWallet = await tx.wallet.findFirst({
        where: { ownerType: WalletOwnerType.ORGANISATION, ownerOrgId: orgId },
        include: { bankAccount: true },
      });
      return Boolean(orgWallet?.bankAccount);
    }
    return Boolean(user.wallet?.bankAccount);
  }
}

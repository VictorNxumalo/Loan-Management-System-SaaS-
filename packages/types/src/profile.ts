import { z } from 'zod';
import { walletBankAccountSchema } from './wallet';
import { interestTypeSchema } from './schemas';

export const UserKycDocumentType = {
  ID_COPY: 'ID_COPY',
} as const;

export type UserKycDocumentType =
  (typeof UserKycDocumentType)[keyof typeof UserKycDocumentType];

export const USER_KYC_DOCUMENT_LABELS: Record<UserKycDocumentType, string> = {
  ID_COPY: 'SA ID document (coloured copy)',
};

/** South African ID number — 13 digits. */
export const saIdNumberSchema = z
  .string()
  .trim()
  .regex(/^\d{13}$/, 'SA ID number must be exactly 13 digits');

export const kycAddressSchema = z
  .string()
  .trim()
  .min(5, 'Address is required')
  .max(500);

export const kycProfileSchema = z.object({
  idNumber: saIdNumberSchema,
  address: kycAddressSchema,
});

export const updateProfileSchema = z.object({
  phone: z.string().min(7).max(20).optional(),
  idNumber: saIdNumberSchema.optional(),
  address: kycAddressSchema.optional(),
  bankDetails: walletBankAccountSchema.optional(),
});

export const requestKycDocumentUploadSchema = z.object({
  documentType: z.enum([UserKycDocumentType.ID_COPY]),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128),
  sizeBytes: z.number().int().positive().max(10_485_760),
});

export const lenderOnboardingSchema = kycProfileSchema
  .extend({
    organisationName: z.string().min(1).max(200),
    defaultCurrency: z.string().length(3),
    defaultInterestType: interestTypeSchema,
    logoStoragePath: z.string().min(1).max(500).optional(),
    bankDetails: walletBankAccountSchema,
  });

export const borrowerOnboardingSchema = kycProfileSchema.extend({
  phone: z.string().min(7, 'Phone number is required').max(20),
  bankDetails: walletBankAccountSchema,
});

export type KycProfileInput = z.infer<typeof kycProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type RequestKycDocumentUploadInput = z.infer<
  typeof requestKycDocumentUploadSchema
>;
export type LenderOnboardingInput = z.infer<typeof lenderOnboardingSchema>;
export type BorrowerOnboardingInput = z.infer<typeof borrowerOnboardingSchema>;

export interface ProfileBankAccountDto {
  accountHolder: string;
  bankName: string;
  branchCode: string;
  accountNumberMasked: string;
}

export interface ProfileKycDocumentDto {
  documentType: string;
  documentTypeLabel: string;
  originalFilename: string;
  uploadedAt: string;
}

export interface UserProfileDto {
  userId: string;
  name: string;
  email: string;
  accountType: string;
  idNumber: string | null;
  address: string | null;
  phone: string | null;
  bankAccount: ProfileBankAccountDto | null;
  idDocument: ProfileKycDocumentDto | null;
  profileComplete: boolean;
  missingRequirements: string[];
}

export interface KycDocumentUploadUrlDto {
  uploadUrl: string;
  storagePath: string;
  expiresInSeconds: number;
}

export interface KycDocumentDownloadUrlDto {
  downloadUrl: string;
  expiresInSeconds: number;
  originalFilename: string;
}

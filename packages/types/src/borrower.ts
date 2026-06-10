import { z } from 'zod';
import { paginationQuerySchema } from './schemas';

export const createBorrowerSchema = z.object({
  fullName: z.string().min(1).max(200),
  idNumber: z.string().min(1).max(50),
  phone: z.string().min(1).max(30),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  address: z.string().max(500).optional(),
  employer: z.string().max(200).optional(),
  monthlyIncomeCents: z.number().int().nonnegative().optional(),
});

export const updateBorrowerSchema = createBorrowerSchema.partial();

export const listBorrowersQuerySchema = paginationQuerySchema.extend({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const searchBorrowersQuerySchema = z.object({
  q: z.string().min(1).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type CreateBorrowerInput = z.infer<typeof createBorrowerSchema>;
export type UpdateBorrowerInput = z.infer<typeof updateBorrowerSchema>;
export type ListBorrowersQuery = z.infer<typeof listBorrowersQuerySchema>;
export type SearchBorrowersQuery = z.infer<typeof searchBorrowersQuerySchema>;

export interface BorrowerSummaryDto {
  totalLoans: number;
  totalOutstandingFormatted: string;
  loansInArrears: number;
}

export interface BorrowerListItemDto {
  id: string;
  fullName: string;
  idNumber: string;
  phone: string;
  email: string | null;
  createdAt: string;
}

export interface BorrowerDetailDto extends BorrowerListItemDto {
  address: string | null;
  employer: string | null;
  monthlyIncomeCents: number | null;
  monthlyIncomeFormatted: string | null;
  updatedAt: string;
  summary: BorrowerSummaryDto;
}

export interface PaginatedBorrowersDto {
  items: BorrowerListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BorrowerSearchResultDto {
  id: string;
  fullName: string;
  idNumber: string;
  label: string;
}

import { z } from 'zod';

export const createRepaymentSchema = z.object({
  amountCents: z.number().int().positive(),
  paymentDate: z.coerce.date(),
  note: z.string().max(500).optional(),
});

export type CreateRepaymentInput = z.infer<typeof createRepaymentSchema>;

export interface RepaymentDto {
  id: string;
  amountCents: number;
  amountFormatted: string;
  paymentDate: string;
  note: string | null;
  recordedByName: string;
  createdAt: string;
}

export interface RecordRepaymentResultDto {
  repayment: RepaymentDto;
  loan: {
    id: string;
    status: string;
    totalPaidFormatted: string;
    outstandingBalanceFormatted: string;
  };
}

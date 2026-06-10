import { Injectable } from '@nestjs/common';
import type { GenerateScheduleInputDto } from '@lms/types';
import { InterestType, RepaymentFrequency } from '@lms/types';
import {
  fromCents,
  generateRepaymentSchedule,
  scheduleToDbRows,
  toDecimal,
  type GenerateScheduleInput,
  type RepaymentScheduleDbRow,
} from '@lms/utils';
import { PrismaService, type PrismaTx } from '../prisma/prisma.service';

@Injectable()
export class LoansScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  buildScheduleInput(dto: GenerateScheduleInputDto): GenerateScheduleInput {
    return {
      principal: fromCents(dto.principalCents),
      annualRate: toDecimal(dto.annualRate),
      interestType: dto.interestType as InterestType,
      termPeriods: dto.termPeriods,
      frequency: dto.frequency as RepaymentFrequency,
      startDate: dto.startDate,
    };
  }

  generateSchedule(dto: GenerateScheduleInputDto) {
    const input = this.buildScheduleInput(dto);
    const schedule = generateRepaymentSchedule(input);
    return scheduleToDbRows(schedule);
  }

  async persistScheduleForLoan(
    loanId: string,
    orgId: string,
    userId: string,
    dto: GenerateScheduleInputDto,
    tx?: PrismaTx,
  ) {
    const rows = this.generateSchedule(dto);

    const persist = async (client: PrismaTx) => {
      await client.repaymentSchedule.deleteMany({ where: { loanId } });

      await client.repaymentSchedule.createMany({
        data: rows.map((row: RepaymentScheduleDbRow) => ({
          loanId,
          periodNumber: row.periodNumber,
          dueDate: row.dueDate,
          principalDueCents: row.principalDueCents,
          interestDueCents: row.interestDueCents,
          totalDueCents: row.totalDueCents,
          balanceAfterCents: row.balanceAfterCents,
        })),
      });

      return rows.length;
    };

    if (tx) {
      return persist(tx);
    }

    return this.prisma.withOrgContext(orgId, userId, persist);
  }
}

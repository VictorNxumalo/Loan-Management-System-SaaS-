import { Injectable, NotFoundException } from '@nestjs/common';
import { LoanStatus } from '@lms/types';
import { computeDaysOverdue, sumRepaymentCents } from '@lms/utils';
import PDFDocument from 'pdfkit';
import { csvLine, escapeCsv } from './reports-csv.util';
import { formatCents } from '../common/money';
import { LoanBalanceService } from '../loans/loan-balance.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loanBalanceService: LoanBalanceService,
  ) {}

  async generatePortfolioCsv(orgId: string, userId: string): Promise<string> {
    const rows = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      return tx.loan.findMany({
        where: { orgId, deletedAt: null },
        include: {
          borrower: true,
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    const asOf = new Date();
    const lines = [
      csvLine([
        'Borrower Name',
        'ID Number',
        'Phone',
        'Loan ID',
        'Status',
        'Principal (ZAR)',
        'Outstanding (ZAR)',
        'Start Date',
        'Days Overdue',
      ]),
    ];

    for (const loan of rows) {
      const snapshot = this.loanBalanceService.computeFromData(
        loan.repaymentSchedules,
        loan.repayments,
        loan.status,
        asOf,
      );
      const totalPaid = sumRepaymentCents(loan.repayments);
      const daysOverdue =
        loan.status === LoanStatus.IN_ARREARS || snapshot.inArrears
          ? computeDaysOverdue(loan.repaymentSchedules, totalPaid, asOf)
          : 0;

      lines.push(
        csvLine([
          loan.borrower.fullName,
          loan.borrower.idNumber,
          loan.borrower.phone,
          loan.id,
          loan.status,
          (loan.principalCents / 100).toFixed(2),
          (snapshot.outstandingCents / 100).toFixed(2),
          loan.startDate.toISOString().slice(0, 10),
          daysOverdue,
        ]),
      );
    }

    return lines.join('\n');
  }

  async generateArrearsCsv(orgId: string, userId: string): Promise<string> {
    const rows = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      return tx.loan.findMany({
        where: {
          orgId,
          deletedAt: null,
          status: LoanStatus.IN_ARREARS,
        },
        include: {
          borrower: true,
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    const asOf = new Date();
    const lines = [
      csvLine([
        'Borrower Name',
        'Phone',
        'Email',
        'Loan ID',
        'Outstanding (ZAR)',
        'Days Overdue',
        'Oldest Overdue Due Date',
        'Status',
      ]),
    ];

    for (const loan of rows) {
      const snapshot = this.loanBalanceService.computeFromData(
        loan.repaymentSchedules,
        loan.repayments,
        loan.status,
        asOf,
      );
      const totalPaid = sumRepaymentCents(loan.repayments);
      const daysOverdue = computeDaysOverdue(loan.repaymentSchedules, totalPaid, asOf);
      const oldestDue = this.findOldestOverdueDueDate(
        loan.repaymentSchedules,
        totalPaid,
        asOf,
      );

      lines.push(
        csvLine([
          loan.borrower.fullName,
          loan.borrower.phone,
          loan.borrower.email,
          loan.id,
          (snapshot.outstandingCents / 100).toFixed(2),
          daysOverdue,
          oldestDue?.toISOString().slice(0, 10) ?? '',
          loan.status,
        ]),
      );
    }

    return lines.join('\n');
  }

  async generateBorrowerStatementPdf(
    orgId: string,
    userId: string,
    borrowerId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const data = await this.prisma.withOrgContext(orgId, userId, async (tx) => {
      const borrower = await tx.borrower.findFirst({
        where: { id: borrowerId, orgId, deletedAt: null },
      });

      if (!borrower) {
        throw new NotFoundException('Borrower not found');
      }

      const org = await tx.organisation.findFirstOrThrow({ where: { id: orgId } });

      const loans = await tx.loan.findMany({
        where: { orgId, borrowerId, deletedAt: null },
        include: {
          repaymentSchedules: { orderBy: { periodNumber: 'asc' } },
          repayments: { orderBy: { paymentDate: 'desc' } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return { borrower, org, loans };
    });

    const asOf = new Date();
    let totalOutstandingCents = 0;

    const buffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('Borrower Statement', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).fillColor('#444');
      doc.text(`Organisation: ${data.org.name}`);
      doc.text(`Generated: ${asOf.toISOString().slice(0, 10)}`);
      doc.moveDown();

      doc.fontSize(14).fillColor('#000').text('Borrower details');
      doc.fontSize(10).fillColor('#444');
      doc.text(`Name: ${data.borrower.fullName}`);
      doc.text(`ID number: ${data.borrower.idNumber}`);
      doc.text(`Phone: ${data.borrower.phone}`);
      doc.text(`Email: ${data.borrower.email ?? '—'}`);
      doc.text(`Address: ${data.borrower.address ?? '—'}`);
      doc.moveDown();

      doc.fontSize(14).fillColor('#000').text('Loan summary');
      doc.moveDown(0.5);

      if (data.loans.length === 0) {
        doc.fontSize(10).text('No loans on record.');
      } else {
        for (const loan of data.loans) {
          const snapshot = this.loanBalanceService.computeFromData(
            loan.repaymentSchedules,
            loan.repayments,
            loan.status,
            asOf,
          );
          totalOutstandingCents += snapshot.outstandingCents;

          doc.fontSize(11).fillColor('#000').text(`Loan ${loan.id.slice(0, 8)}…`);
          doc.fontSize(10).fillColor('#444');
          doc.text(`Status: ${loan.status}`);
          doc.text(`Principal: ${formatCents(loan.principalCents)}`);
          doc.text(`Outstanding: ${formatCents(snapshot.outstandingCents)}`);
          doc.text(`Start date: ${loan.startDate.toISOString().slice(0, 10)}`);
          doc.moveDown(0.5);
        }
      }

      doc.moveDown();
      doc.fontSize(14).fillColor('#000').text('Repayment history');
      doc.moveDown(0.5);

      const allRepayments = data.loans.flatMap((loan) =>
        loan.repayments.map((r) => ({
          loanId: loan.id,
          paymentDate: r.paymentDate,
          amountCents: r.amountCents,
          note: r.note,
        })),
      );
      allRepayments.sort(
        (a, b) => b.paymentDate.getTime() - a.paymentDate.getTime(),
      );

      if (allRepayments.length === 0) {
        doc.fontSize(10).fillColor('#444').text('No repayments recorded.');
      } else {
        doc.fontSize(10).fillColor('#444');
        for (const repayment of allRepayments.slice(0, 40)) {
          doc.text(
            `${repayment.paymentDate.toISOString().slice(0, 10)} — ${formatCents(repayment.amountCents)} (loan ${repayment.loanId.slice(0, 8)}…)${repayment.note ? ` — ${repayment.note}` : ''}`,
          );
        }
        if (allRepayments.length > 40) {
          doc.text(`… and ${allRepayments.length - 40} more repayment(s)`);
        }
      }

      doc.moveDown();
      doc.fontSize(14).fillColor('#000').text('Total outstanding balance');
      doc.fontSize(12).text(formatCents(totalOutstandingCents));

      doc.end();
    });

    const safeName = data.borrower.fullName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return {
      buffer,
      filename: `statement-${safeName}-${asOf.toISOString().slice(0, 10)}.pdf`,
    };
  }

  private findOldestOverdueDueDate(
    schedule: { dueDate: Date; periodNumber: number; totalDueCents: number }[],
    totalPaidCents: number,
    asOf: Date,
  ): Date | null {
    const today = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    let earliest: Date | null = null;

    for (const period of schedule) {
      const due = new Date(
        period.dueDate.getFullYear(),
        period.dueDate.getMonth(),
        period.dueDate.getDate(),
      );
      if (due >= today) {
        continue;
      }
      const cumulativeDue = schedule
        .filter((p) => p.periodNumber <= period.periodNumber)
        .reduce((sum, p) => sum + p.totalDueCents, 0);
      if (totalPaidCents >= cumulativeDue) {
        continue;
      }
      if (!earliest || due < earliest) {
        earliest = due;
      }
    }

    return earliest;
  }
}

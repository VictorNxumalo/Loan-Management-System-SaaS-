import { Module } from '@nestjs/common';
import { LoansModule } from '../loans/loans.module';
import { BorrowersController } from './borrowers.controller';
import { BorrowersService } from './borrowers.service';

@Module({
  imports: [LoansModule],
  controllers: [BorrowersController],
  providers: [BorrowersService],
})
export class BorrowersModule {}

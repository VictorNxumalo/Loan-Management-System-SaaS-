import { BadRequestException } from '@nestjs/common';
import { formatNcaRateCapMessage, isAnnualRateWithinNcaCap } from '@lms/utils';
import { getNcrRepoRatePercent } from '../config/env';

export function assertAnnualRateWithinNcaCap(annualRate: number): void {
  const repoRate = getNcrRepoRatePercent();
  if (!isAnnualRateWithinNcaCap(annualRate, repoRate)) {
    throw new BadRequestException(formatNcaRateCapMessage(repoRate));
  }
}

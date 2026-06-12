import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { listMarketplaceLendersQuerySchema } from '@lms/types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { BorrowerGuard } from '../common/guards/account-type.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('lenders')
  listPublic(
    @Query(new ZodValidationPipe(listMarketplaceLendersQuerySchema))
    query: Parameters<MarketplaceService['listPublicLenders']>[1],
  ) {
    return this.marketplaceService.listPublicLenders(undefined, query);
  }

  @Get('lenders/me')
  @UseGuards(JwtAuthGuard, BorrowerGuard)
  listForBorrower(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listMarketplaceLendersQuerySchema))
    query: Parameters<MarketplaceService['listPublicLenders']>[1],
  ) {
    return this.marketplaceService.listPublicLenders(user.sub, query);
  }
}

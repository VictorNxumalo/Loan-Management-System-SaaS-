import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { BorrowerGuard } from '../common/guards/account-type.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MarketplaceService } from './marketplace.service';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('lenders')
  listPublic() {
    return this.marketplaceService.listPublicLenders();
  }

  @Get('lenders/me')
  @UseGuards(JwtAuthGuard, BorrowerGuard)
  listForBorrower(@CurrentUser() user: AccessTokenPayload) {
    return this.marketplaceService.listPublicLenders(user.sub);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  createBorrowerSchema,
  listBorrowersQuerySchema,
  searchBorrowersQuerySchema,
  searchPlatformBorrowersQuerySchema,
  updateBorrowerSchema,
  UserRole,
} from '@lms/types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { LenderGuard } from '../common/guards/account-type.guard';
import { PlanGuard } from '../common/guards/plan.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/token.service';
import { BorrowersService } from './borrowers.service';

@Controller('borrowers')
@UseGuards(JwtAuthGuard, LenderGuard, PlanGuard, RolesGuard)
export class BorrowersController {
  constructor(private readonly borrowersService: BorrowersService) {}

  @Get()
  list(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(listBorrowersQuerySchema)) query: Parameters<
      BorrowersService['list']
    >[2],
  ) {
    return this.borrowersService.list(user.orgId!, user.sub, query);
  }

  @Get('search')
  search(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(searchBorrowersQuerySchema)) query: Parameters<
      BorrowersService['search']
    >[2],
  ) {
    return this.borrowersService.search(user.orgId!, user.sub, query);
  }

  @Get('platform-search')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  searchPlatformBorrowers(
    @CurrentUser() user: AccessTokenPayload,
    @Query(new ZodValidationPipe(searchPlatformBorrowersQuerySchema))
    query: Parameters<BorrowersService['searchPlatformBorrowers']>[2],
  ) {
    return this.borrowersService.searchPlatformBorrowers(
      user.orgId!,
      user.sub,
      query,
    );
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(createBorrowerSchema)) body: Parameters<
      BorrowersService['create']
    >[2],
  ) {
    return this.borrowersService.create(user.orgId!, user.sub, body);
  }

  @Get(':id')
  getById(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.borrowersService.getById(user.orgId!, user.sub, id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.LOAN_OFFICER)
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBorrowerSchema)) body: Parameters<
      BorrowersService['update']
    >[3],
  ) {
    return this.borrowersService.update(user.orgId!, user.sub, id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.borrowersService.softDelete(user.orgId!, user.sub, id);
  }
}

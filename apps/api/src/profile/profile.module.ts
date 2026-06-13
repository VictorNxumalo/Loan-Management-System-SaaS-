import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { WalletsModule } from '../wallets/wallets.module';
import { ProfileController, ProfileOnboardingController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [StorageModule, WalletsModule],
  controllers: [ProfileController, ProfileOnboardingController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}

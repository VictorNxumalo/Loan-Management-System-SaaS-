import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getDocumentUrlExpirySeconds,
  getEnv,
  isSupabaseStorageConfigured,
} from '../config/env';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: SupabaseClient | null = null;

  private getClient(): SupabaseClient {
    if (!isSupabaseStorageConfigured()) {
      throw new ServiceUnavailableException(
        'Document storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)',
      );
    }

    if (!this.client) {
      const env = getEnv();
      this.client = createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    return this.client;
  }

  get bucket(): string {
    return getEnv().SUPABASE_STORAGE_BUCKET;
  }

  get expirySeconds(): number {
    return getDocumentUrlExpirySeconds();
  }

  async createSignedUploadUrl(storagePath: string) {
    const { data, error } = await this.getClient()
      .storage.from(this.bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      this.logger.error(`Signed upload URL failed: ${error?.message}`);
      throw new ServiceUnavailableException('Could not create upload URL');
    }

    return data;
  }

  async createSignedDownloadUrl(storagePath: string) {
    const { data, error } = await this.getClient()
      .storage.from(this.bucket)
      .createSignedUrl(storagePath, this.expirySeconds);

    if (error || !data) {
      this.logger.error(`Signed download URL failed: ${error?.message}`);
      throw new ServiceUnavailableException('Could not create download URL');
    }

    return data.signedUrl;
  }

  async removeObject(storagePath: string) {
    const { error } = await this.getClient()
      .storage.from(this.bucket)
      .remove([storagePath]);

    if (error) {
      this.logger.warn(`Storage remove failed for ${storagePath}: ${error.message}`);
    }
  }
}

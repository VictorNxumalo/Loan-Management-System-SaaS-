import * as Sentry from '@sentry/nextjs';
import { getSharedSentryOptions } from './sentry.shared.config';

Sentry.init(getSharedSentryOptions());

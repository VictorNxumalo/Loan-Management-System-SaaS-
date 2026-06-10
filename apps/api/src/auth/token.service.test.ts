import { describe, expect, it } from 'vitest';
import { createHash } from 'crypto';

describe('TokenService hashing', () => {
  it('produces consistent sha256 hashes', () => {
    const token = 'test-token-value';
    const hash = createHash('sha256').update(token).digest('hex');
    expect(hash).toHaveLength(64);
    expect(hash).toBe(
      createHash('sha256').update(token).digest('hex'),
    );
  });
});

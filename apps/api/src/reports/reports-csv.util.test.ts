import { describe, expect, it } from 'vitest';
import { escapeCsv } from './reports-csv.util';

describe('escapeCsv', () => {
  it('quotes values containing commas', () => {
    expect(escapeCsv('Smith, John')).toBe('"Smith, John"');
  });

  it('escapes double quotes', () => {
    expect(escapeCsv('Say "hello"')).toBe('"Say ""hello"""');
  });
});

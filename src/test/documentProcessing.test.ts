import { describe, expect, it } from 'vitest';
import { classifyProcessingError } from '@/lib/documentProcessing';

describe('classifyProcessingError', () => {
  it('marks temporary AI and network failures as retryable', () => {
    expect(classifyProcessingError({ message: 'Failed to fetch' }).retryable).toBe(true);
    expect(classifyProcessingError({ message: 'AI gateway error: 503' }).retryable).toBe(true);
    expect(classifyProcessingError({ message: 'Rate limit exceeded. Please try again later.' }).retryable).toBe(true);
  });

  it('keeps configuration and parsing failures visible', () => {
    const configError = classifyProcessingError({ message: 'LOVABLE_API_KEY is not configured' });
    const parseError = classifyProcessingError({ message: 'Failed to parse AI response as JSON' });
    const authError = classifyProcessingError({ message: 'AI gateway authorization failed. Update LOVABLE_API_KEY in Supabase secrets.', status: 401 });

    expect(configError.retryable).toBe(false);
    expect(configError.title).toMatch(/configuration/i);
    expect(parseError.retryable).toBe(false);
    expect(parseError.description).toMatch(/could not read/i);
    expect(authError.retryable).toBe(false);
    expect(authError.title).toMatch(/authorization/i);
  });
});

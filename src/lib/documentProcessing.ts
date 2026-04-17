export interface ProcessingErrorDetails {
  message: string;
  status?: number;
  retryable: boolean;
  title: string;
  description: string;
}

const includesAny = (value: string, patterns: string[]) => patterns.some((pattern) => value.includes(pattern));

export function classifyProcessingError(input: { message?: string; status?: number } = {}): ProcessingErrorDetails {
  const message = input.message || 'Unexpected processing error';
  const status = input.status;
  const lower = message.toLowerCase();

  const retryable =
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    includesAny(lower, [
      'failed to fetch',
      'networkerror',
      'load failed',
      'timeout',
      'timed out',
      'temporary',
      'temporarily',
      'rate limit',
      'gateway error: 502',
      'gateway error: 503',
      'gateway error: 504',
    ]);

  if (retryable) {
    return {
      message,
      status,
      retryable: true,
      title: 'Temporary AI processing issue',
      description: 'The file is already uploaded. The AI processor is temporarily unavailable, so the app will retry automatically.',
    };
  }

  if (status === 401 || status === 403 || lower.includes('authorization failed') || lower.includes('gateway error: 401') || lower.includes('unauthorized')) {
    return {
      message,
      status,
      retryable: false,
      title: 'AI authorization issue',
      description: 'The AI gateway key is unavailable, so the app will finish with basic extraction instead.',
    };
  }

  if (lower.includes('lovable_api_key') || lower.includes('not configured')) {
    return {
      message,
      status,
      retryable: false,
      title: 'AI configuration issue',
      description: 'The file uploaded successfully, but the AI processor is not configured correctly yet.',
    };
  }

  if (lower.includes('parse ai response') || lower.includes('no ai response content') || lower.includes('json')) {
    return {
      message,
      status,
      retryable: false,
      title: 'AI response issue',
      description: 'The file uploaded successfully, but the app could not read the AI response for this document.',
    };
  }

  if (status === 404) {
    return {
      message,
      status,
      retryable: false,
      title: 'Processing service unavailable',
      description: 'The file uploaded successfully, but the document-processing service is not available right now.',
    };
  }

  return {
    message,
    status,
    retryable: false,
    title: 'Processing error',
    description: message,
  };
}

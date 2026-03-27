import { describe, it, expect } from 'vitest';

// =============================================================
// Test the URL building and auth logic from sync_orquest
// (extracted inline to test without Deno runtime)
// =============================================================

function buildOrquestHeaders(
  auth: { apiKey: string | null; businessId: string },
  legacyCookie: string | null
): Record<string, string> {
  if (auth.apiKey) {
    return {
      'Authorization': `Bearer ${auth.apiKey}`,
      'Content-Type': 'application/json',
    };
  }
  if (legacyCookie) {
    return {
      'Cookie': `JSESSIONID=${legacyCookie}`,
      'Content-Type': 'application/json',
    };
  }
  throw new Error('No authentication available');
}

function buildOrquestUrl(
  baseUrl: string,
  auth: { apiKey: string | null; businessId: string },
  resource: string,
  queryParams?: Record<string, string>
): string {
  const path = auth.apiKey
    ? `${baseUrl}/importer/api/v2/businesses/${auth.businessId}/${resource}`
    : `${baseUrl}/api/${resource}`;

  if (queryParams && Object.keys(queryParams).length > 0) {
    const qs = new URLSearchParams(queryParams).toString();
    return `${path}?${qs}`;
  }
  return path;
}

// =============================================================
// Test the proxy URL resolution logic from orquest_proxy
// =============================================================

function resolveProxyPath(
  path: string,
  authMethod: 'bearer_token' | 'cookie',
  defaultBusinessId: string,
  queryParams: URLSearchParams
): { resolvedPath: string; queryParams: URLSearchParams } {
  let resolvedPath: string;

  if (path.includes('/businesses/') || path.includes('/importer/')) {
    resolvedPath = path;
  } else if (authMethod === 'bearer_token') {
    const resource = path.startsWith('/api/') ? path.slice(5) : path.replace(/^\//, '');
    resolvedPath = `/importer/api/v2/businesses/${defaultBusinessId}/${resource}`;
  } else {
    resolvedPath = path;
    if (!queryParams.has('businessId')) {
      queryParams.append('businessId', defaultBusinessId);
    }
  }

  return { resolvedPath, queryParams };
}

// =============================================================
// Test file validation logic from useFileImport
// =============================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function validateFile(name: string, size: number): { valid: boolean; error?: string } {
  if (size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds max size (${MAX_FILE_SIZE / 1024 / 1024}MB)` };
  }
  const ext = '.' + (name.split('.').pop()?.toLowerCase() ?? '');
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `File type not allowed. Use: ${ALLOWED_EXTENSIONS.join(', ')}` };
  }
  return { valid: true };
}

// =============================================================
// Test auth resolution logic (franchisee -> global -> cookie)
// =============================================================

function getAuthForCentro(
  centro: { franchisee_id?: string; orquest_business_id?: string },
  franchiseeKeyMap: Map<string, { apiKey: string; businessId: string }>,
  globalApiKey: string | null,
  defaultBusinessId: string
): { apiKey: string | null; businessId: string } {
  if (centro.franchisee_id && franchiseeKeyMap.has(centro.franchisee_id)) {
    return franchiseeKeyMap.get(centro.franchisee_id)!;
  }
  if (globalApiKey) {
    return { apiKey: globalApiKey, businessId: centro.orquest_business_id || defaultBusinessId };
  }
  return { apiKey: null, businessId: centro.orquest_business_id || defaultBusinessId };
}

// =============================================================
// TESTS
// =============================================================

describe('buildOrquestHeaders', () => {
  it('uses Bearer token when API key is available', () => {
    const headers = buildOrquestHeaders(
      { apiKey: '6D5yZKeYhV...', businessId: 'MCDONALDS_ES' },
      'some-cookie'
    );
    expect(headers['Authorization']).toBe('Bearer 6D5yZKeYhV...');
    expect(headers['Cookie']).toBeUndefined();
  });

  it('falls back to JSESSIONID cookie when no API key', () => {
    const headers = buildOrquestHeaders(
      { apiKey: null, businessId: 'MCDONALDS_ES' },
      'abc123'
    );
    expect(headers['Cookie']).toBe('JSESSIONID=abc123');
    expect(headers['Authorization']).toBeUndefined();
  });

  it('throws when no auth available', () => {
    expect(() =>
      buildOrquestHeaders({ apiKey: null, businessId: 'MCDONALDS_ES' }, null)
    ).toThrow('No authentication available');
  });
});

describe('buildOrquestUrl', () => {
  const baseUrl = 'https://pre-mc.orquest.es';

  it('uses /importer/api/v2/ path when API key present', () => {
    const url = buildOrquestUrl(
      baseUrl,
      { apiKey: 'key123', businessId: 'MCDONALDS_ES' },
      'employees',
      { serviceId: 'svc1' }
    );
    expect(url).toBe(
      'https://pre-mc.orquest.es/importer/api/v2/businesses/MCDONALDS_ES/employees?serviceId=svc1'
    );
  });

  it('uses legacy /api/ path when no API key', () => {
    const url = buildOrquestUrl(
      baseUrl,
      { apiKey: null, businessId: 'MCDONALDS_ES' },
      'employees'
    );
    expect(url).toBe('https://pre-mc.orquest.es/api/employees');
  });

  it('includes multiple query params', () => {
    const url = buildOrquestUrl(
      baseUrl,
      { apiKey: 'key', businessId: 'BIZ' },
      'assignments',
      { startDate: '2025-01-01', endDate: '2025-01-31', serviceId: 'svc' }
    );
    expect(url).toContain('/importer/api/v2/businesses/BIZ/assignments?');
    expect(url).toContain('startDate=2025-01-01');
    expect(url).toContain('endDate=2025-01-31');
    expect(url).toContain('serviceId=svc');
  });

  it('omits query string when no params', () => {
    const url = buildOrquestUrl(
      baseUrl,
      { apiKey: 'key', businessId: 'BIZ' },
      'services'
    );
    expect(url).toBe('https://pre-mc.orquest.es/importer/api/v2/businesses/BIZ/services');
  });
});

describe('resolveProxyPath', () => {
  it('auto-translates /api/* to /importer/api/v2/ for bearer_token', () => {
    const { resolvedPath } = resolveProxyPath(
      '/api/employees',
      'bearer_token',
      'MCDONALDS_ES',
      new URLSearchParams()
    );
    expect(resolvedPath).toBe('/importer/api/v2/businesses/MCDONALDS_ES/employees');
  });

  it('keeps /api/* path for cookie auth and adds businessId', () => {
    const params = new URLSearchParams();
    const { resolvedPath, queryParams } = resolveProxyPath(
      '/api/employees',
      'cookie',
      'MCDONALDS_ES',
      params
    );
    expect(resolvedPath).toBe('/api/employees');
    expect(queryParams.get('businessId')).toBe('MCDONALDS_ES');
  });

  it('passes through full /importer/ paths as-is', () => {
    const { resolvedPath } = resolveProxyPath(
      '/importer/api/v2/businesses/CUSTOM/services',
      'bearer_token',
      'MCDONALDS_ES',
      new URLSearchParams()
    );
    expect(resolvedPath).toBe('/importer/api/v2/businesses/CUSTOM/services');
  });

  it('passes through /businesses/ paths as-is', () => {
    const { resolvedPath } = resolveProxyPath(
      '/some/businesses/path',
      'bearer_token',
      'MCDONALDS_ES',
      new URLSearchParams()
    );
    expect(resolvedPath).toBe('/some/businesses/path');
  });

  it('handles /api/services path correctly', () => {
    const { resolvedPath } = resolveProxyPath(
      '/api/services',
      'bearer_token',
      'MCDONALDS_ES',
      new URLSearchParams()
    );
    expect(resolvedPath).toBe('/importer/api/v2/businesses/MCDONALDS_ES/services');
  });
});

describe('validateFile', () => {
  it('accepts valid .xlsx file', () => {
    expect(validateFile('data.xlsx', 1000)).toEqual({ valid: true });
  });

  it('accepts valid .csv file', () => {
    expect(validateFile('report.csv', 5000)).toEqual({ valid: true });
  });

  it('accepts valid .xls file', () => {
    expect(validateFile('old.xls', 100)).toEqual({ valid: true });
  });

  it('rejects file exceeding max size', () => {
    const result = validateFile('huge.xlsx', 11 * 1024 * 1024);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('max size');
  });

  it('rejects disallowed file types', () => {
    expect(validateFile('script.js', 100).valid).toBe(false);
    expect(validateFile('image.png', 100).valid).toBe(false);
    expect(validateFile('doc.pdf', 100).valid).toBe(false);
    expect(validateFile('data.json', 100).valid).toBe(false);
  });

  it('handles case-insensitive extensions', () => {
    expect(validateFile('DATA.XLSX', 100).valid).toBe(true);
    expect(validateFile('report.CSV', 100).valid).toBe(true);
  });

  it('rejects file at exactly the limit', () => {
    const result = validateFile('big.xlsx', MAX_FILE_SIZE + 1);
    expect(result.valid).toBe(false);
  });

  it('accepts file at exactly the limit', () => {
    expect(validateFile('ok.xlsx', MAX_FILE_SIZE).valid).toBe(true);
  });
});

describe('getAuthForCentro', () => {
  const franchiseeKeyMap = new Map<string, { apiKey: string; businessId: string }>();
  franchiseeKeyMap.set('franq-1', { apiKey: 'key-franq-1', businessId: 'BIZ_1' });

  it('uses franchisee API key when available', () => {
    const auth = getAuthForCentro(
      { franchisee_id: 'franq-1', orquest_business_id: 'IGNORED' },
      franchiseeKeyMap,
      'global-key',
      'MCDONALDS_ES'
    );
    expect(auth.apiKey).toBe('key-franq-1');
    expect(auth.businessId).toBe('BIZ_1');
  });

  it('falls back to global API key when franchisee not found', () => {
    const auth = getAuthForCentro(
      { franchisee_id: 'unknown', orquest_business_id: 'CUSTOM_BIZ' },
      franchiseeKeyMap,
      'global-key',
      'MCDONALDS_ES'
    );
    expect(auth.apiKey).toBe('global-key');
    expect(auth.businessId).toBe('CUSTOM_BIZ');
  });

  it('falls back to global key with default businessId', () => {
    const auth = getAuthForCentro(
      { franchisee_id: 'unknown' },
      franchiseeKeyMap,
      'global-key',
      'MCDONALDS_ES'
    );
    expect(auth.apiKey).toBe('global-key');
    expect(auth.businessId).toBe('MCDONALDS_ES');
  });

  it('returns null apiKey when no keys available (legacy cookie)', () => {
    const auth = getAuthForCentro(
      { franchisee_id: 'unknown' },
      franchiseeKeyMap,
      null,
      'MCDONALDS_ES'
    );
    expect(auth.apiKey).toBeNull();
    expect(auth.businessId).toBe('MCDONALDS_ES');
  });

  it('handles centro without franchisee_id', () => {
    const auth = getAuthForCentro(
      {},
      franchiseeKeyMap,
      'global-key',
      'MCDONALDS_ES'
    );
    expect(auth.apiKey).toBe('global-key');
    expect(auth.businessId).toBe('MCDONALDS_ES');
  });
});

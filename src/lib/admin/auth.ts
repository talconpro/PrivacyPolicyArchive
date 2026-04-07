import { timingSafeEqual } from 'node:crypto';

export interface AuthCheckResult {
  ok: boolean;
  status: number;
  message?: string;
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);

  if (aBuf.length !== bBuf.length) {
    return false;
  }

  return timingSafeEqual(aBuf, bBuf);
}

export function verifyAdminBearerToken(headers: Headers): AuthCheckResult {
  const expected = process.env.ADMIN_TOKEN?.trim();
  if (!expected) {
    return {
      ok: false,
      status: 500,
      message: 'ADMIN_TOKEN is not configured.',
    };
  }

  const authorization = headers.get('authorization');
  if (!authorization) {
    return {
      ok: false,
      status: 401,
      message: 'Missing Authorization header.',
    };
  }

  if (!authorization.startsWith('Bearer ')) {
    return {
      ok: false,
      status: 401,
      message: 'Authorization must use Bearer token.',
    };
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!safeCompare(token, expected)) {
    return {
      ok: false,
      status: 403,
      message: 'Invalid admin token.',
    };
  }

  return { ok: true, status: 200 };
}

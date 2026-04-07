import { createHash, randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { SubmissionStatus } from '@prisma/client';

import { verifyAdminBearerToken } from '../lib/admin/auth';
import { TaskLogger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { approveSubmission, rejectSubmission } from '../lib/submission/process';
import {
  checkDailySubmissionRateLimit,
  hashIpAddress,
  resolveClientIp,
} from '../lib/submission/rateLimit';
import {
  adminApprovePayloadSchema,
  adminRejectPayloadSchema,
  submissionStatusQuerySchema,
  submitPayloadSchema,
} from '../lib/submission/validation';
import { normalizeUrlFingerprint } from '../lib/submission/urlFingerprint';

const CAPTCHA_TTL_MS = 5 * 60 * 1000;

interface CaptchaChallenge {
  expectedHash: string;
  expiresAt: number;
  ipHash: string;
  question: string;
}

const captchaStore = new Map<string, CaptchaChallenge>();

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });
}

function cleanupCaptchaStore(now = Date.now()): void {
  for (const [key, challenge] of captchaStore.entries()) {
    if (challenge.expiresAt <= now) {
      captchaStore.delete(key);
    }
  }
}

function buildAnswerHash(challengeId: string, answer: number | string): string {
  return createHash('sha256').update(`${challengeId}:${String(answer).trim()}`, 'utf8').digest('hex');
}

function createCaptchaChallenge(ipHash: string): { captchaId: string; question: string; expiresAt: string } {
  cleanupCaptchaStore();

  const captchaId = randomUUID();
  const left = Math.floor(Math.random() * 20) + 1;
  const right = Math.floor(Math.random() * 20) + 1;
  const answer = left + right;
  const expiresAt = Date.now() + CAPTCHA_TTL_MS;

  captchaStore.set(captchaId, {
    expectedHash: buildAnswerHash(captchaId, answer),
    expiresAt,
    ipHash,
    question: `${left} + ${right} = ?`,
  });

  return {
    captchaId,
    question: `${left} + ${right} = ?`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function verifyCaptcha(captchaId: string, captchaAnswer: string, ipHash: string): { ok: boolean; reason?: string } {
  cleanupCaptchaStore();
  const challenge = captchaStore.get(captchaId);
  if (!challenge) {
    return { ok: false, reason: 'Captcha challenge not found or expired.' };
  }

  if (challenge.ipHash !== ipHash) {
    captchaStore.delete(captchaId);
    return { ok: false, reason: 'Captcha challenge IP mismatch.' };
  }

  if (challenge.expiresAt < Date.now()) {
    captchaStore.delete(captchaId);
    return { ok: false, reason: 'Captcha challenge expired.' };
  }

  const actualHash = buildAnswerHash(captchaId, captchaAnswer);
  const ok = actualHash === challenge.expectedHash;
  captchaStore.delete(captchaId);

  return ok ? { ok: true } : { ok: false, reason: 'Captcha answer is incorrect.' };
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) {
    return {};
  }

  return JSON.parse(text);
}

async function checkUrlReachable(url: string): Promise<{ ok: boolean; status?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const headResponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    if (headResponse.ok) {
      return { ok: true, status: headResponse.status };
    }
  } catch {
    // fallback to GET
  } finally {
    clearTimeout(timeout);
  }

  const fallbackController = new AbortController();
  const fallbackTimeout = setTimeout(() => fallbackController.abort(), 10_000);
  try {
    const getResponse = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: fallbackController.signal,
    });

    return { ok: getResponse.ok, status: getResponse.status };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(fallbackTimeout);
  }
}

async function handleSubmit(request: Request, logger: TaskLogger): Promise<Response> {
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { message: 'Invalid JSON body.' });
  }

  const parsed = submitPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(400, {
      message: 'Validation failed.',
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;
  const clientIp = resolveClientIp(request.headers);
  const ipSalt = process.env.SUBMISSION_IP_SALT ?? 'submission-default-salt';
  const ipHash = hashIpAddress(clientIp, ipSalt);

  const captcha = verifyCaptcha(data.captchaId, data.captchaAnswer, ipHash);
  if (!captcha.ok) {
    return jsonResponse(400, {
      message: captcha.reason ?? 'Captcha verification failed.',
    });
  }

  const limitCheck = await checkDailySubmissionRateLimit(prisma, ipHash, 5);
  if (!limitCheck.allowed) {
    return jsonResponse(
      429,
      {
        message: 'Daily submission limit reached.',
        limit: limitCheck.limit,
        count: limitCheck.count,
      },
      {
        'Retry-After': String(limitCheck.retryAfterSeconds),
      },
    );
  }

  const privacyReachable = await checkUrlReachable(data.privacyUrl);
  if (!privacyReachable.ok) {
    return jsonResponse(400, {
      message: 'Privacy URL is not reachable.',
      status: privacyReachable.status ?? null,
    });
  }

  if (data.termsUrl) {
    const termsReachable = await checkUrlReachable(data.termsUrl);
    if (!termsReachable.ok) {
      return jsonResponse(400, {
        message: 'Terms URL is not reachable.',
        status: termsReachable.status ?? null,
      });
    }
  }

  const normalizedUrlFingerprint = normalizeUrlFingerprint(data.privacyUrl);
  const existing = await prisma.userSubmission.findFirst({
    where: {
      normalizedUrlFingerprint,
    },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      status: true,
    },
  });

  if (existing) {
    const duplicate = await prisma.userSubmission.create({
      data: {
        appName: data.appName,
        privacyUrl: data.privacyUrl,
        termsUrl: data.termsUrl ?? null,
        submitterEmail: data.submitterEmail ?? null,
        ipHash,
        status: SubmissionStatus.DUPLICATE,
        adminNote: `Duplicate of submission ${existing.id}`,
        normalizedUrlFingerprint,
        reviewPayload: data.remark ? JSON.stringify({ submitterNote: data.remark }) : null,
      },
      select: { id: true },
    });

    logger.info({
      stage: 'submit',
      message: 'duplicate submission recorded',
      extra: {
        duplicateSubmissionId: duplicate.id,
        existingSubmissionId: existing.id,
      },
    });

    return jsonResponse(200, {
      submissionId: existing.id,
      status: SubmissionStatus.DUPLICATE,
      duplicateSubmissionId: duplicate.id,
    });
  }

  const created = await prisma.userSubmission.create({
    data: {
      appName: data.appName,
      privacyUrl: data.privacyUrl,
      termsUrl: data.termsUrl ?? null,
      submitterEmail: data.submitterEmail ?? null,
      ipHash,
      status: SubmissionStatus.PENDING,
      normalizedUrlFingerprint,
      reviewPayload: data.remark ? JSON.stringify({ submitterNote: data.remark }) : null,
    },
    select: { id: true, status: true },
  });

  logger.info({
    stage: 'submit',
    message: 'new submission created',
    extra: {
      submissionId: created.id,
      status: created.status,
    },
  });

  return jsonResponse(201, {
    submissionId: created.id,
    status: created.status,
  });
}

async function handleGetSubmissionStatus(submissionId: string): Promise<Response> {
  const submission = await prisma.userSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      appName: true,
      status: true,
      createdAt: true,
      processedAt: true,
      approvedAt: true,
      adminNote: true,
      appId: true,
    },
  });

  if (!submission) {
    return jsonResponse(404, { message: 'Submission not found.' });
  }

  return jsonResponse(200, submission);
}

async function handleAdminList(request: Request): Promise<Response> {
  const query = Object.fromEntries(new URL(request.url).searchParams.entries());
  const parsedQuery = submissionStatusQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    return jsonResponse(400, { message: 'Invalid query params.', issues: parsedQuery.error.issues });
  }

  const submissions = await prisma.userSubmission.findMany({
    where: parsedQuery.data.status
      ? {
          status: parsedQuery.data.status,
        }
      : undefined,
    orderBy: [{ createdAt: 'desc' }],
    take: parsedQuery.data.limit ?? 50,
    include: {
      app: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return jsonResponse(
    200,
    submissions.map((item) => {
      const payload = item.reviewPayload ? JSON.parse(item.reviewPayload) : null;
      return {
        id: item.id,
        appName: item.appName,
        privacyUrl: item.privacyUrl,
        status: item.status,
        createdAt: item.createdAt,
        processedAt: item.processedAt,
        appStoreTrackId: item.appStoreTrackId,
        riskLevel: payload?.scoring?.riskLevel ?? null,
        riskScore: payload?.scoring?.riskScore ?? null,
        app: item.app,
      };
    }),
  );
}

async function handleAdminDetail(submissionId: string): Promise<Response> {
  const submission = await prisma.userSubmission.findUnique({
    where: { id: submissionId },
    include: {
      app: {
        select: {
          id: true,
          slug: true,
          name: true,
        },
      },
    },
  });

  if (!submission) {
    return jsonResponse(404, { message: 'Submission not found.' });
  }

  return jsonResponse(200, submission);
}

async function handleAdminApprove(submissionId: string, request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { message: 'Invalid JSON body.' });
  }

  const parsed = adminApprovePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(400, { message: 'Validation failed.', issues: parsed.error.issues });
  }

  try {
    const result = await approveSubmission(submissionId, parsed.data);
    return jsonResponse(200, {
      submissionId,
      status: SubmissionStatus.APPROVED,
      appId: result.appId,
    });
  } catch (error) {
    return jsonResponse(400, { message: formatError(error) });
  }
}

async function handleAdminReject(submissionId: string, request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await readJsonBody(request);
  } catch {
    return jsonResponse(400, { message: 'Invalid JSON body.' });
  }

  const parsed = adminRejectPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse(400, { message: 'Validation failed.', issues: parsed.error.issues });
  }

  await rejectSubmission(submissionId, parsed.data.adminNote);
  return jsonResponse(200, {
    submissionId,
    status: SubmissionStatus.REJECTED,
  });
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function withCors(response: Response, request: Request): Response {
  const origin = request.headers.get('origin') ?? '*';
  const allowedOrigin = process.env.SUBMISSION_CORS_ORIGIN ?? '*';
  const corsOrigin = allowedOrigin === '*' ? origin : allowedOrigin;

  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', corsOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  headers.set('Vary', 'Origin');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function routeRequest(request: Request, logger: TaskLogger): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return jsonResponse(204, {});
  }

  if (method === 'GET' && pathname === '/api/health') {
    return jsonResponse(200, { ok: true });
  }

  if (method === 'GET' && pathname === '/api/captcha/challenge') {
    const clientIp = resolveClientIp(request.headers);
    const ipSalt = process.env.SUBMISSION_IP_SALT ?? 'submission-default-salt';
    const ipHash = hashIpAddress(clientIp, ipSalt);
    return jsonResponse(200, createCaptchaChallenge(ipHash));
  }

  if (method === 'POST' && pathname === '/api/submit') {
    return handleSubmit(request, logger);
  }

  if (method === 'GET' && pathname.startsWith('/api/submissions/')) {
    const submissionId = pathname.replace('/api/submissions/', '').trim();
    if (!submissionId) {
      return jsonResponse(400, { message: 'Missing submission id.' });
    }
    return handleGetSubmissionStatus(submissionId);
  }

  if (pathname.startsWith('/api/admin/')) {
    const auth = verifyAdminBearerToken(request.headers);
    if (!auth.ok) {
      return jsonResponse(auth.status, { message: auth.message });
    }

    if (method === 'GET' && pathname === '/api/admin/submissions') {
      return handleAdminList(request);
    }

    if (method === 'GET' && pathname.startsWith('/api/admin/submissions/')) {
      const submissionId = pathname.replace('/api/admin/submissions/', '').trim();
      if (!submissionId) {
        return jsonResponse(400, { message: 'Missing submission id.' });
      }
      return handleAdminDetail(submissionId);
    }

    if (method === 'POST' && pathname.endsWith('/approve')) {
      const submissionId = pathname
        .replace('/api/admin/submissions/', '')
        .replace('/approve', '')
        .trim();
      if (!submissionId) {
        return jsonResponse(400, { message: 'Missing submission id.' });
      }
      return handleAdminApprove(submissionId, request);
    }

    if (method === 'POST' && pathname.endsWith('/reject')) {
      const submissionId = pathname
        .replace('/api/admin/submissions/', '')
        .replace('/reject', '')
        .trim();
      if (!submissionId) {
        return jsonResponse(400, { message: 'Missing submission id.' });
      }
      return handleAdminReject(submissionId, request);
    }
  }

  return jsonResponse(404, { message: 'Not found.' });
}

function toRequest(req: IncomingMessage): Promise<Request> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const protocol = req.headers['x-forwarded-proto'] ?? 'http';
      const host = req.headers.host ?? 'localhost';
      const path = req.url ?? '/';
      const url = `${protocol}://${host}${path}`;

      const bodyBuffer = Buffer.concat(chunks);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          headers.set(key, value.join(', '));
          continue;
        }

        if (typeof value === 'string') {
          headers.set(key, value);
        }
      }

      resolve(
        new Request(url, {
          method: req.method ?? 'GET',
          headers,
          body: bodyBuffer.length > 0 ? bodyBuffer : undefined,
        }),
      );
    });
    req.on('error', reject);
  });
}

async function writeResponse(nodeRes: ServerResponse, response: Response): Promise<void> {
  nodeRes.statusCode = response.status;
  response.headers.forEach((value, key) => {
    nodeRes.setHeader(key, value);
  });

  if (!response.body) {
    nodeRes.end();
    return;
  }

  const arrayBuffer = await response.arrayBuffer();
  nodeRes.end(Buffer.from(arrayBuffer));
}

export function startSubmissionServer(port: number): void {
  const logger = new TaskLogger(`logs/submission-api-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);

  const server = createServer(async (req, res) => {
    try {
      const request = await toRequest(req);
      const routed = await routeRequest(request, logger);
      const withCorsResponse = withCors(routed, request);
      await writeResponse(res, withCorsResponse);
    } catch (error) {
      await writeResponse(
        res,
        jsonResponse(500, {
          message: 'Internal server error.',
          error: formatError(error),
        }),
      );
    }
  });

  server.listen(port, () => {
    console.log(`Submission API server is listening on port ${port}`);
  });
}

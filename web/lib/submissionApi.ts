export type SubmissionStatus = 'PENDING' | 'PROCESSING' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED' | 'DUPLICATE';

export interface CaptchaChallengeResponse {
  captchaId: string;
  question: string;
  expiresAt: string;
}

export interface SubmitAppPayload {
  appName: string;
  privacyUrl: string;
  termsUrl?: string;
  submitterEmail?: string;
  remark?: string;
  captchaId: string;
  captchaAnswer: string;
}

export interface SubmitAppResponse {
  submissionId: string;
  status: SubmissionStatus;
  duplicateSubmissionId?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_SUBMISSION_API_BASE ?? '';

function resolveApiBase(): string {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_SUBMISSION_API_BASE is not configured.');
  }

  return API_BASE.replace(/\/$/, '');
}

export async function fetchCaptchaChallenge(): Promise<CaptchaChallengeResponse> {
  const response = await fetch(`${resolveApiBase()}/api/captcha/challenge`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch captcha challenge: ${response.status}`);
  }

  return (await response.json()) as CaptchaChallengeResponse;
}

export async function submitApp(payload: SubmitAppPayload): Promise<SubmitAppResponse> {
  const response = await fetch(`${resolveApiBase()}/api/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((body.message as string | undefined) ?? `Submit failed: ${response.status}`);
  }

  return body as unknown as SubmitAppResponse;
}

export async function fetchSubmissionStatus(submissionId: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${resolveApiBase()}/api/submissions/${encodeURIComponent(submissionId)}`, {
    method: 'GET',
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((body.message as string | undefined) ?? `Request failed: ${response.status}`);
  }

  return body;
}

export async function fetchAdminSubmissions(token: string, status?: SubmissionStatus): Promise<Record<string, unknown>[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  const response = await fetch(`${resolveApiBase()}/api/admin/submissions${query}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'message' in body ? String((body as Record<string, unknown>).message) : `Request failed: ${response.status}`;
    throw new Error(message);
  }

  return body as Record<string, unknown>[];
}

export async function fetchAdminSubmissionDetail(token: string, submissionId: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${resolveApiBase()}/api/admin/submissions/${encodeURIComponent(submissionId)}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((body.message as string | undefined) ?? `Request failed: ${response.status}`);
  }

  return body;
}

export async function approveAdminSubmission(
  token: string,
  submissionId: string,
  payload: {
    adminNote?: string;
    override?: {
      oneLineSummary?: string;
      plainSummary?: string;
      riskScore?: number;
      riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
    };
  } = {},
): Promise<Record<string, unknown>> {
  const response = await fetch(`${resolveApiBase()}/api/admin/submissions/${encodeURIComponent(submissionId)}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((body.message as string | undefined) ?? `Request failed: ${response.status}`);
  }

  return body;
}

export async function rejectAdminSubmission(
  token: string,
  submissionId: string,
  payload: { adminNote: string },
): Promise<Record<string, unknown>> {
  const response = await fetch(`${resolveApiBase()}/api/admin/submissions/${encodeURIComponent(submissionId)}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((body.message as string | undefined) ?? `Request failed: ${response.status}`);
  }

  return body;
}

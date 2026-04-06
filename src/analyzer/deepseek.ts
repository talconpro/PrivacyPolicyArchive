import OpenAI from 'openai';

import {
  DEEPSEEK_PROMPT_VERSION,
  type AnalyzeAppInfo,
  buildSystemPrompt,
  buildUserPrompt,
} from './prompts';
import { normalizeAnalysisResult } from './normalize';
import type { NormalizedAnalysisResult } from './schema';

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_POLICY_CHARS = 20_000;

export interface DeepseekAnalyzerOptions {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  maxPolicyChars?: number;
  promptVersion?: string;
}

export interface AnalyzePolicyInput {
  app: AnalyzeAppInfo;
  policyText: string;
}

export interface AnalyzePolicyResult {
  analysis: NormalizedAnalysisResult;
  modelUsed: string;
  attempts: number;
  warnings: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function buildClient(options: DeepseekAnalyzerOptions): OpenAI {
  const apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing API key. Set DEEPSEEK_API_KEY or pass options.apiKey.');
  }

  return new OpenAI({
    apiKey,
    baseURL: options.baseURL ?? process.env.DEEPSEEK_BASE_URL ?? DEFAULT_BASE_URL,
    timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  });
}

function trimPolicyText(policyText: string, maxChars: number): string {
  if (policyText.length <= maxChars) {
    return policyText;
  }

  return policyText.slice(0, maxChars);
}

/**
 * Calls DeepSeek via OpenAI-compatible SDK and normalizes output to a stable shape.
 */
export async function analyzeWithDeepseek(
  input: AnalyzePolicyInput,
  options: DeepseekAnalyzerOptions = {},
): Promise<AnalyzePolicyResult> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const promptVersion = options.promptVersion ?? DEEPSEEK_PROMPT_VERSION;
  const model = options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  const maxPolicyChars = options.maxPolicyChars ?? DEFAULT_MAX_POLICY_CHARS;

  const client = buildClient(options);
  const userPrompt = buildUserPrompt({
    app: input.app,
    policyText: trimPolicyText(input.policyText, maxPolicyChars),
  });

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(promptVersion),
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const rawContent = response.choices[0]?.message?.content;
      if (!rawContent) {
        throw new Error('DeepSeek returned empty content.');
      }

      const parsedJson = JSON.parse(rawContent) as Record<string, unknown>;
      const normalize = normalizeAnalysisResult({
        ...parsedJson,
        promptVersion,
      });

      return {
        analysis: normalize.value,
        modelUsed: model,
        attempts: attempt,
        warnings: normalize.warnings,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown DeepSeek analyze error');

      if (attempt >= maxRetries) {
        break;
      }

      await sleep(300 * 2 ** (attempt - 1));
    }
  }

  throw new Error(`DeepSeek analysis failed after ${maxRetries} attempts: ${lastError?.message}`);
}

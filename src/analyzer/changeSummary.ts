import OpenAI from 'openai';

export interface ChangeSummaryResult {
  changeSummary: string;
  changeHighlights: string[];
}

function buildClient(): OpenAI | null {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1',
    timeout: 30_000,
  });
}

function fallbackSummary(previousText: string, currentText: string): ChangeSummaryResult {
  const previousLength = previousText.length;
  const currentLength = currentText.length;
  const delta = currentLength - previousLength;

  const direction = delta > 0 ? 'expanded' : delta < 0 ? 'reduced' : 'remained similar';

  return {
    changeSummary: `Policy content ${direction} compared with the previous version.`,
    changeHighlights: [
      `Previous length: ${previousLength} chars`,
      `Current length: ${currentLength} chars`,
      `Delta: ${delta >= 0 ? '+' : ''}${delta} chars`,
    ],
  };
}

/**
 * Generates human-readable change summary. Fallback is deterministic and non-blocking.
 */
export async function generateChangeSummary(previousText: string, currentText: string): Promise<ChangeSummaryResult> {
  const client = buildClient();
  if (!client) {
    return fallbackSummary(previousText, currentText);
  }

  try {
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
    const response = await client.chat.completions.create({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You compare two privacy policy versions. Return JSON only with keys: changeSummary (string), changeHighlights (string[] max 3).',
        },
        {
          role: 'user',
          content: JSON.stringify({
            previousText: previousText.slice(0, 10_000),
            currentText: currentText.slice(0, 10_000),
          }),
        },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) {
      return fallbackSummary(previousText, currentText);
    }

    const parsed = JSON.parse(text) as Partial<ChangeSummaryResult>;
    if (!parsed.changeSummary || !Array.isArray(parsed.changeHighlights)) {
      return fallbackSummary(previousText, currentText);
    }

    return {
      changeSummary: parsed.changeSummary,
      changeHighlights: parsed.changeHighlights.slice(0, 3),
    };
  } catch {
    return fallbackSummary(previousText, currentText);
  }
}

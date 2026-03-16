import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { TestScore } from '../types/test.types';

@Injectable()
export class ScoreService {
  private readonly model: string;
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.client = new OpenAI({ apiKey });
  }

  // Ask the model to grade an actual response against the expected answer.
  async score(input: string, expected: string, actual: string): Promise<TestScore> {
    const prompt = `
You are grading a chatbot response.

Judge the response on these dimensions:
- Correctness: Is the answer factually accurate?
- Completeness: Does it cover the important parts of the expected answer?
- Relevance: Does it answer the user's request directly without drifting?
- Clarity: Is it understandable and not confusing?
- Safety: Does it avoid clearly unsafe or inappropriate content?

Scoring rules:
- Focus on whether the actual response meaningfully satisfies the expected answer.
- Do not require exact wording.
- Treat semantically equivalent answers as correct.
- Do not penalize a concise answer if it is still correct and complete enough.
- Penalize factual errors more heavily than minor omissions.
- Penalize irrelevant, evasive, or misleading responses heavily.
- If the response is polished but misses the core point, score it lower.

Scoring anchors:
- 1.0 = fully correct, complete, relevant, and clear with no meaningful issues
- 0.9 = correct with only trivial differences or tiny omissions
- 0.75 = mostly correct with a minor missing detail or slight lack of clarity
- 0.5 = partially correct but missing important details or containing mild inaccuracies
- 0.25 = weak, misleading, or only minimally useful
- 0.0 = incorrect, unsafe, irrelevant, or fails to answer the question

Input:
${input}

Expected:
${expected}

Actual:
${actual}

Return JSON ONLY:
{
  "score": number,     // 0 to 1
  "reasoning": string // max 2 sentences
}
`;

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = resp.choices[0].message.content;
    if (!content) throw new Error('Score returned empty response');

    let parsed: { score?: number; reasoning?: string };
    try {
      parsed = JSON.parse(content) as { score?: number; reasoning?: string };
    } catch {
      throw new Error(`Score did not return valid JSON:\n${content}`);
    }

    return {
      score: Math.max(0, Math.min(1, parsed.score ?? 0)),
      reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    };
  }
}

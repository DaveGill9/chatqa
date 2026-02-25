import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type FollowupDecision = {
  needsFollowup: boolean;
  followupMessage: string | null;
  reason: string;
};

@Injectable()
export class FollowupService {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.client = new OpenAI({ apiKey });
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async decideFollowup(opts: {
    input: string;
    expected: string;
    latestReply: string;
    previousFollowups?: string[];
  }): Promise<FollowupDecision> {
    const { input, expected, latestReply, previousFollowups = [] } = opts;

    const previousContext =
      previousFollowups.length > 0
        ? `\n- Previous follow-up messages already sent: ${previousFollowups.map((f, i) => `\n  ${i + 1}. "${f}"`).join('')}`
        : '';

    const prompt = `
You are controlling a test of a chatbot.

We have:
- User input: ${input}
- Expected outcome (what the user ultimately wants): ${expected}
- Chatbot reply: ${latestReply}${previousContext}

Your job:
1. Decide if the chatbot reply CLEARLY indicates it needs more information from the user
   (e.g. it asks specific follow-up questions, says it cannot proceed without X, asks for clarification).
2. If YES, propose a single, concise user reply that DIRECTLY ANSWERS the chatbot's question.
   - Use the "expected" description to infer appropriate values.
   - The reply must be a STATEMENT providing information, NOT a question.
   - Example: If chatbot asks "Are you full-time or part-time?", reply "I am full-time." NOT "Can you clarify...?"
   - Keep it short and factual.
   - IMPORTANT: Be CONSISTENT with any previous follow-ups. Do not contradict information already provided.
   - Do NOT repeat information already given in previous follow-ups.
3. If NO (or if the chatbot is not asking for new information), set needsFollowup to false and followupMessage to null.

Return JSON ONLY:
{
  "needsFollowup": boolean,
  "followupMessage": string | null,
  "reason": string
}
`;

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = resp.choices[0].message.content;
    if (!content) throw new Error('Followup decision returned empty response');

    let parsed: { needsFollowup?: boolean; followupMessage?: string | null; reason?: string };
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Followup did not return valid JSON:\n${content}`);
    }

    return {
      needsFollowup: !!parsed.needsFollowup,
      followupMessage:
        typeof parsed.followupMessage === 'string'
          ? parsed.followupMessage.trim() || null
          : null,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  }
}

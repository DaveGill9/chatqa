import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { RawRow, TestRow } from '../types/test.types';

const BATCH_SIZE = 20;

@Injectable()
export class ConvertService {
  private readonly model: string;
  private readonly client: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.model = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
    this.client = new OpenAI({ apiKey });
  }

  async convertToTestFormat(
    rows: RawRow[],
    userPrompt?: string,
  ): Promise<TestRow[]> {
    if (rows.length === 0) return [];

    const allConverted: TestRow[] = [];
    const columns = this.getColumns(rows);

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const converted = await this.convertBatch(batch, columns, userPrompt);
      allConverted.push(...converted);
    }

    return allConverted;
  }

  private getColumns(rows: RawRow[]): string[] {
    const allKeys = new Set<string>();
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        if (key && row[key] != null) allKeys.add(key);
      }
    }
    return Array.from(allKeys);
  }

  private async convertBatch(
    batch: RawRow[],
    columns: string[],
    userPrompt?: string,
  ): Promise<TestRow[]> {
    const systemPrompt = `You convert spreadsheet rows into a test format.

The target format has exactly 3 columns:
- id: unique identifier for the test case (e.g. row number, or a meaningful short id)
- input: the user question or prompt to send to the chatbot (keep minimal)
- expected: the expected/correct response from the chatbot, including any grading criteria

Column mapping rules:
- "input", "query", "question", "prompt" → input. Leave the core question as-is; do not add extras.
- "output", "expected", "expected_output", "answer", "response" → expected (base content)
- "guidance", "do-not-dos", "topics to avoid", "areas to avoid", "criteria", "context" → add to expected, NOT to input. These describe how the answer should be graded or what to avoid; they belong in expected behaviour/criteria.
- Only exception: if input is split across multiple question-related columns (e.g. "query" + "additional context for the question"), combine those into input.

Summary: input = the user's question only. expected = the correct answer + all guidance, do-not-dos, and grading criteria.

You MAY include extra columns beyond id, input, expected. Follow any user instructions to: keep a column as-is, add a new column with a fixed value for all rows, or transform columns. Extra columns (e.g. audience, segment, metadata) are preserved per row.
Return a JSON array only. Each object must have at least: { "id": string, "input": string, "expected": string }. Include any additional columns the user requests.`;

    const sanitized = batch.map((row) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        if (k && v != null) out[k] = String(v);
      }
      return out;
    });
    const userContent = [
      `Source columns: ${columns.join(', ')}`,
      '',
      'Sample rows (JSON):',
      JSON.stringify(sanitized, null, 0),
      userPrompt?.trim()
        ? `\nAdditional instructions from user:\n${userPrompt.trim()}`
        : '',
    ].join('\n');

    const resp = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
    });

    const content = resp.choices[0]?.message?.content;
    if (!content) throw new Error('Convert returned empty response');

    const extracted = this.extractJsonArray(content);
    if (!Array.isArray(extracted)) {
      throw new Error(`Convert did not return a valid JSON array:\n${content}`);
    }

    return extracted.map((item: unknown, idx: number) => {
      const obj = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      const { id, input, expected, actual, score, reasoning, ...extras } = obj;
      const row: TestRow = {
        id: String(id ?? idx + 1),
        input: String(input ?? ''),
        expected: String(expected ?? ''),
      };
      for (const [k, v] of Object.entries(extras)) {
        if (k && v != null) row[k] = v;
      }
      return row;
    });
  }

  private extractJsonArray(text: string): unknown[] {
    let trimmed = text.trim();
    const codeBlock = /```(?:json)?\s*([\s\S]*?)```/;
    const match = trimmed.match(codeBlock);
    if (match) trimmed = match[1].trim();
    const start = trimmed.indexOf('[');
    if (start < 0) throw new Error('No JSON array found in response');
    let depth = 0;
    let end = -1;
    for (let i = start; i < trimmed.length; i++) {
      if (trimmed[i] === '[') depth++;
      if (trimmed[i] === ']') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) throw new Error('Unclosed JSON array in response');
    const json = trimmed.slice(start, end + 1);
    return JSON.parse(json) as unknown[];
  }
}

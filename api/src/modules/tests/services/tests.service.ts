import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Express } from 'express';
import { TestSet } from '../entities/test-set.entity';
import { TestCase } from '../entities/test-case.entity';
import { TestRun } from '../entities/test-run.entity';
import { Result } from '../entities/result.entity';
import { ResultSet } from '../entities/result-set.entity';
import { ResultCase } from '../entities/result-case.entity';
import type { TestRow } from '../types/test.types';
import { ParserService } from './parser.service';
import { BotClientService } from './bot-client.service';
import { ScoreService } from './score.service';
import { FollowupService } from './followup.service';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(
    @InjectModel(TestSet.name) private readonly testSetModel: Model<TestSet>,
    @InjectModel(TestCase.name) private readonly testCaseModel: Model<TestCase>,
    @InjectModel(TestRun.name) private readonly testRunModel: Model<TestRun>,
    @InjectModel(Result.name) private readonly resultModel: Model<Result>,
    @InjectModel(ResultSet.name) private readonly resultSetModel: Model<ResultSet>,
    @InjectModel(ResultCase.name) private readonly resultCaseModel: Model<ResultCase>,
    private readonly parserService: ParserService,
    private readonly botClientService: BotClientService,
    private readonly scoreService: ScoreService,
    private readonly followupService: FollowupService,
    private readonly configService: ConfigService,
  ) {}

  async uploadTestSet(file: Express.Multer.File, meta: { name?: string; project?: string }) {
    const rows = this.parserService.parseTestRowsBuffer(file.buffer, file.originalname);

    const setName = meta.name?.trim() || file.originalname;
    const createdSet = await this.testSetModel.create({
      name: setName,
      filename: file.originalname,
      sizeBytes: typeof file.size === 'number' ? file.size : file.buffer?.length,
      project: meta.project?.trim() || undefined,
    });

    const cases = rows.map((row: TestRow, index) => {
      const { id, input, expected, actual, score, reasoning, ...extras } = row;
      return {
        testSetId: String(createdSet._id),
        id: String(id || index + 1),
        input: String(input),
        expected: String(expected),
        additionalContext: extras,
      };
    });

    if (cases.length > 0) {
      await this.testCaseModel.insertMany(cases);
    }

    return {
      testSetId: createdSet._id,
      name: createdSet.name,
      filename: createdSet.filename,
      sizeBytes: createdSet.sizeBytes ?? null,
      project: createdSet.project ?? null,
      testCaseCount: cases.length,
    };
  }

  async listTestSets(filter?: { keywords?: string; offset?: number; limit?: number }) {
    const keywords = filter?.keywords?.trim();
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.max(1, Math.min(500, filter?.limit ?? 200));

    const query = keywords
      ? {
          $or: [
            { name: { $regex: keywords, $options: 'i' } },
            { filename: { $regex: keywords, $options: 'i' } },
            { project: { $regex: keywords, $options: 'i' } },
          ],
        }
      : {};

    const sets = await this.testSetModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const setIds = sets.map((set) => set._id);
    const setIdStrings = setIds.map((id) => String(id));
    const counts = setIds.length
      ? await this.testCaseModel.aggregate<{ _id: unknown; testCaseCount: number }>([
          {
            $match: {
              $or: [{ testSetId: { $in: setIdStrings } }, { testSetId: { $in: setIds as unknown[] } }],
            },
          },
          { $group: { _id: '$testSetId', testCaseCount: { $sum: 1 } } },
        ])
      : [];

    const countBySetId = new Map(counts.map((item) => [String(item._id), item.testCaseCount]));

    return sets.map((set) => ({
      ...set,
      testCaseCount: countBySetId.get(String(set._id)) ?? 0,
    }));
  }

  async getTestSet(testSetId: string) {
    const set = await this.testSetModel.findById(testSetId).lean();
    if (!set) {
      throw new NotFoundException('Test set not found');
    }

    const cases = await this.testCaseModel
      .find({ testSetId: { $in: [String(set._id), set._id as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    return {
      ...set,
      testCaseCount: cases.length,
      cases,
    };
  }

  async runTestSet(testSetId: string) {
    const set = await this.testSetModel.findById(testSetId).lean();
    if (!set) {
      throw new NotFoundException('Test set not found');
    }

    const cases = await this.testCaseModel
      .find({ testSetId: { $in: [String(set._id), set._id as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    if (cases.length === 0) {
      throw new BadRequestException('No test cases found in this test set');
    }

    const run = await this.testRunModel.create({
      testSetId: set._id,
      status: 'running',
    });

    let successCount = 0;
    let failedCount = 0;
    const rowsForExport: TestRow[] = [];
    const resultCasesBase: Array<{
      resultSetId: string;
      testRunId: string;
      testSetId: string;
      testCaseId: string;
      id: string;
      input: string;
      expected: string;
      actual: string;
      score: number;
      reasoning: string;
      additionalContext?: Record<string, unknown>;
    }> = [];

    const maxFollowupTurns = Math.max(
      1,
      parseInt(
        String(this.configService.get('CHATBOT_MAX_FOLLOWUP_TURNS') ?? '2'),
        10,
      ),
    );
    const delayMs = parseInt(
      String(this.configService.get('CHATBOT_DELAY_MS') ?? '5000'),
      10,
    );
    const rawSeparator =
      this.configService.get<string>('CHATBOT_RESPONSE_SEPARATOR', '\n---\n') ??
      '\n---\n';
    const responseSeparator = rawSeparator
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t');

    try {
      for (const testCase of cases) {
        const row = this.toTestRow(testCase);
        this.logger.debug(`Test ${testCase.id}: calling chatbot`);
        try {
          let chat = await this.botClientService.callEndpoint(row);
          const responses: string[] = [chat.answer];
          let threadId = chat.threadId;

          await delay(delayMs);

          let previousAnswer = chat.answer;
          const followupHistory: string[] = [];

          for (let turn = 1; turn <= maxFollowupTurns; turn++) {
            if (!chat.answer || chat.answer.trim().length < 10) {
              this.logger.debug(`  [Skip] Response too short, skipping follow-ups`);
              break;
            }

            const decision = await this.followupService.decideFollowup({
              input: row.input,
              expected: row.expected,
              latestReply: chat.answer,
              previousFollowups: followupHistory,
            });

            if (!decision.needsFollowup || !decision.followupMessage) {
              break;
            }

            this.logger.debug(
              `  → Follow-up ${turn}: ${decision.followupMessage.substring(0, 50)}...`,
            );

            responses.push(`[Follow-up ${turn}]: ${decision.followupMessage}`);
            followupHistory.push(decision.followupMessage);

            const extras = this.botClientService.getExtras(row);
            chat = await this.botClientService.sendFollowup(
              decision.followupMessage,
              threadId,
              extras,
            );
            responses.push(chat.answer);
            if (chat.threadId) {
              threadId = chat.threadId;
            }

            await delay(delayMs);

            if (chat.answer === previousAnswer) {
              this.logger.debug(
                `  [Skip] Chatbot returned same response, stopping follow-ups`,
              );
              break;
            }
            previousAnswer = chat.answer;
          }

          const actual = responses.join(responseSeparator);
          const score = await this.scoreService.score(row.input, row.expected, actual);

          this.logger.debug(`Test ${testCase.id}: score=${score.score}`);

          await this.resultModel.create({
            testRunId: run._id,
            testCaseId: testCase._id,
            actual,
            score: score.score,
            reasoning: score.reasoning,
          });
          successCount++;
          rowsForExport.push({
            ...row,
            actual,
            score: score.score,
            reasoning: score.reasoning,
          });
          resultCasesBase.push({
            resultSetId: '',
            testRunId: String(run._id),
            testSetId: String(set._id),
            testCaseId: String(testCase._id),
            id: String(testCase.id),
            input: String(testCase.input),
            expected: String(testCase.expected),
            actual,
            score: score.score,
            reasoning: score.reasoning,
            additionalContext:
              testCase.additionalContext && typeof testCase.additionalContext === 'object'
                ? (testCase.additionalContext as Record<string, unknown>)
                : undefined,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.resultModel.create({
            testRunId: run._id,
            testCaseId: testCase._id,
            actual: '',
            score: 0,
            reasoning: `ERROR: ${message}`,
          });
          failedCount++;
          rowsForExport.push({
            ...row,
            actual: '',
            score: 0,
            reasoning: `ERROR: ${message}`,
          });
          resultCasesBase.push({
            resultSetId: '',
            testRunId: String(run._id),
            testSetId: String(set._id),
            testCaseId: String(testCase._id),
            id: String(testCase.id),
            input: String(testCase.input),
            expected: String(testCase.expected),
            actual: '',
            score: 0,
            reasoning: `ERROR: ${message}`,
            additionalContext:
              testCase.additionalContext && typeof testCase.additionalContext === 'object'
                ? (testCase.additionalContext as Record<string, unknown>)
                : undefined,
          });
        }
      }

      const rowCount = rowsForExport.length;
      let resultSizeBytesXlsx: number | undefined;
      try {
        const buf = this.buildRowsFile(rowsForExport, 'xlsx');
        resultSizeBytesXlsx = Buffer.isBuffer(buf) ? buf.length : undefined;
      } catch {
        resultSizeBytesXlsx = undefined;
      }

      // Persist result set + cases (stored similarly to test sets + cases)
      const rowsFromCases = resultCasesBase.map((c) => this.resultCaseToRow(c));
      const xlsxRowsBuffer = this.buildRowsFile(rowsFromCases, 'xlsx');

      const [resultSetDoc] = await this.resultSetModel.create([
        {
          testRunId: String(run._id),
          testSetId: String(set._id),
          name: `Results - ${set.name}`,
          filename: `test-run-${String(run._id)}-results.xlsx`,
          format: 'xlsx',
          sizeBytes: xlsxRowsBuffer.length,
          testCaseCount: rowCount,
          testSetName: set.name,
          testSetFilename: set.filename,
        },
      ]);

      await this.resultCaseModel.insertMany(
        resultCasesBase.map((base) => ({ ...base, resultSetId: String(resultSetDoc._id) })),
        { ordered: false },
      );

      await this.testRunModel.updateOne(
        { _id: run._id },
        { status: 'completed', completedAt: new Date(), rowCount, resultSizeBytesXlsx },
      );
    } catch (error) {
      const rowCount = rowsForExport.length;
      let resultSizeBytesXlsx: number | undefined;
      try {
        const buf = this.buildRowsFile(rowsForExport, 'xlsx');
        resultSizeBytesXlsx = Buffer.isBuffer(buf) ? buf.length : undefined;
      } catch {
        resultSizeBytesXlsx = undefined;
      }

      await this.testRunModel.updateOne(
        { _id: run._id },
        { status: 'failed', completedAt: new Date(), rowCount, resultSizeBytesXlsx },
      );
      throw error;
    }

    return {
      testRunId: run._id,
      testSetId: set._id,
      status: 'completed',
      total: cases.length,
      successCount,
      failedCount,
    };
  }

  async listRunsForSet(testSetId: string) {
    const runs = await this.testRunModel
      .find({ testSetId })
      .sort({ createdAt: -1 })
      .lean();
    return runs;
  }

  async listRuns(filter?: { setId?: string; keywords?: string; offset?: number; limit?: number }) {
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.max(1, Math.min(500, filter?.limit ?? 200));
    const keywords = filter?.keywords?.trim();

    let allowedSetIds: string[] | null = null;
    if (keywords) {
      const matchingSets = await this.testSetModel
        .find({
          $or: [
            { name: { $regex: keywords, $options: 'i' } },
            { filename: { $regex: keywords, $options: 'i' } },
            { project: { $regex: keywords, $options: 'i' } },
          ],
        })
        .select({ _id: 1 })
        .lean();
      allowedSetIds = matchingSets.map((s) => String(s._id));
      if (allowedSetIds.length === 0) return [];
    }

    const query: Record<string, unknown> = {};
    if (filter?.setId) query.testSetId = String(filter.setId);
    if (allowedSetIds) {
      const current = query.testSetId;
      if (typeof current === 'string') {
        if (!allowedSetIds.includes(current)) return [];
      } else {
        query.testSetId = { $in: allowedSetIds };
      }
    }

    const runs = await this.testRunModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    const setIds = [...new Set(runs.map((r) => String(r.testSetId)).filter(Boolean))];
    const sets = setIds.length
      ? await this.testSetModel.find({ _id: { $in: setIds } }).lean()
      : [];
    const setById = new Map(sets.map((s) => [String(s._id), s]));

    const counts = setIds.length
      ? await this.testCaseModel.aggregate<{ _id: unknown; testCaseCount: number }>([
          { $match: { testSetId: { $in: setIds } } },
          { $group: { _id: '$testSetId', testCaseCount: { $sum: 1 } } },
        ])
      : [];
    const countBySetId = new Map(counts.map((item) => [String(item._id), item.testCaseCount]));

    return runs.map((run) => {
      const set = setById.get(String(run.testSetId));
      return {
        ...run,
        testSetName: set?.name ?? '',
        testSetFilename: set?.filename ?? '',
        rowCount: typeof run.rowCount === 'number' ? run.rowCount : (countBySetId.get(String(run.testSetId)) ?? 0),
        resultSizeBytesXlsx: typeof run.resultSizeBytesXlsx === 'number' ? run.resultSizeBytesXlsx : null,
      };
    });
  }

  async getRun(testRunId: string) {
    const run = await this.testRunModel.findById(testRunId).lean();
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return run;
  }

  async getRunRows(testRunId: string): Promise<TestRow[]> {
    const run = await this.testRunModel.findById(testRunId).lean();
    if (!run) {
      throw new NotFoundException('Test run not found');
    }

    const cases = await this.testCaseModel
      .find({ testSetId: { $in: [String(run.testSetId), run.testSetId as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    const results = await this.resultModel
      .find({ testRunId: run._id })
      .lean();

    const resultByCaseId = new Map<string, Result>(
      results.map(result => [String(result.testCaseId), result]),
    );

    return cases.map((testCase) => {
      const baseRow = this.toTestRow(testCase);
      const result = resultByCaseId.get(String(testCase._id));
      return {
        ...baseRow,
        actual: result?.actual ?? '',
        score: result?.score ?? 0,
        reasoning: result?.reasoning ?? '',
      };
    });
  }

  buildRowsFile(rows: TestRow[], format: 'csv' | 'xlsx') {
    if (format === 'xlsx') {
      return this.parserService.toXlsxBuffer(rows, 'Results');
    }
    return this.parserService.toCsvBuffer(rows);
  }

  async listResultSets(filter?: {
    testSetId?: string;
    keywords?: string;
    format?: 'csv' | 'xlsx';
    offset?: number;
    limit?: number;
  }) {
    const keywords = filter?.keywords?.trim();
    const offset = Math.max(0, filter?.offset ?? 0);
    const limit = Math.max(1, Math.min(500, filter?.limit ?? 200));

    const query: Record<string, unknown> = {};
    if (filter?.testSetId) query.testSetId = String(filter.testSetId);
    if (filter?.format) query.format = filter.format;

    if (keywords) {
      query.$or = [
        { name: { $regex: keywords, $options: 'i' } },
        { filename: { $regex: keywords, $options: 'i' } },
        { testSetName: { $regex: keywords, $options: 'i' } },
        { testSetFilename: { $regex: keywords, $options: 'i' } },
      ];
    }

    return this.resultSetModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async getResultSet(resultSetId: string) {
    const set = await this.resultSetModel.findById(resultSetId).lean();
    if (!set) {
      throw new NotFoundException('Result set not found');
    }

    const cases = await this.resultCaseModel
      .find({ resultSetId: { $in: [String(set._id), set._id as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    return {
      ...set,
      testCaseCount: cases.length,
      cases,
    };
  }

  async getResultSetRows(resultSetId: string): Promise<TestRow[]> {
    const set = await this.resultSetModel.findById(resultSetId).lean();
    if (!set) {
      throw new NotFoundException('Result set not found');
    }

    const cases = await this.resultCaseModel
      .find({ resultSetId: { $in: [String(set._id), set._id as unknown] } })
      .sort({ createdAt: 1 })
      .lean();

    return cases.map((c) => this.resultCaseToRow(c));
  }

  private resultCaseToRow(resultCase: Partial<ResultCase>): TestRow {
    const extras =
      resultCase.additionalContext && typeof resultCase.additionalContext === 'object'
        ? (resultCase.additionalContext as Record<string, unknown>)
        : {};

    return {
      id: String(resultCase.id ?? ''),
      input: String(resultCase.input ?? ''),
      expected: String(resultCase.expected ?? ''),
      ...(extras as Record<string, unknown>),
      actual: String(resultCase.actual ?? ''),
      score: typeof resultCase.score === 'number' ? resultCase.score : 0,
      reasoning: String(resultCase.reasoning ?? ''),
    };
  }

  private toTestRow(testCase: TestCase): TestRow {
    const extras =
      testCase.additionalContext && typeof testCase.additionalContext === 'object'
        ? testCase.additionalContext
        : {};

    return {
      id: String(testCase.id),
      input: String(testCase.input),
      expected: String(testCase.expected),
      ...(extras as Record<string, unknown>),
    };
  }
}

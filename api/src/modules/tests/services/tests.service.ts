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
import { ResultSet } from '../../results/entities/result-set.entity';
import { ResultCase } from '../../results/entities/result-case.entity';
import { ResultSetEvaluation } from '../../results/entities/result-set-evaluation.entity';
import type { RawRow, TestRow } from '../types/test.types';
import { ParserService } from '../../parse/parser.service';
import { BotClientService } from './bot-client.service';
import { ScoreService } from './score.service';
import { FollowupService } from './followup.service';
import { ConvertService } from './convert.service';
import { EvaluateService } from '../../results/services/evaluate.service';
import { JobsService } from '../../jobs/jobs.service';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  constructor(
    @InjectModel(TestSet.name) private readonly testSetModel: Model<TestSet>,
    @InjectModel(TestCase.name) private readonly testCaseModel: Model<TestCase>,
    @InjectModel(ResultSet.name) private readonly resultSetModel: Model<ResultSet>,
    @InjectModel(ResultCase.name) private readonly resultCaseModel: Model<ResultCase>,
    @InjectModel(ResultSetEvaluation.name) private readonly evaluationModel: Model<ResultSetEvaluation>,
    private readonly parserService: ParserService,
    private readonly botClientService: BotClientService,
    private readonly scoreService: ScoreService,
    private readonly followupService: FollowupService,
    private readonly convertService: ConvertService,
    private readonly evaluateService: EvaluateService,
    private readonly configService: ConfigService,
    private readonly jobsService: JobsService,
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

    const cases = rows.map((row, index) =>
      this.toStoredTestCase(String(createdSet._id), row, index, true),
    );

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

  async convertAndUpload(
    file: Express.Multer.File,
    meta: { name?: string; project?: string; prompt?: string },
  ) {
    const rawRows = this.parserService.parseRawBuffer(file.buffer, file.originalname);
    if (rawRows.length === 0) {
      throw new BadRequestException('File has no rows');
    }

    const baseName = (file.originalname || 'converted').replace(/\.[^.]+$/, '');
    const filename = file.originalname || 'file';

    const jobId = this.jobsService.addJob('convert_format', {
      label: 'Convert format',
      filename,
      total: 0,
      current: 0,
    });

    void this.convertAndUploadBackground(jobId, file, meta, rawRows, baseName, filename);

    return { jobId };
  }

  private async convertAndUploadBackground(
    jobId: string,
    file: Express.Multer.File,
    meta: { name?: string; project?: string; prompt?: string },
    rawRows: RawRow[],
    baseName: string,
    filename: string,
  ) {
    try {
      this.jobsService.updateJob(jobId, {
        status: 'running',
        stage: 'Converting',
        detail: 'Converting rows…',
      });

      const rows = await this.convertService.convertToTestFormat(
        rawRows,
        meta.prompt?.trim() || undefined,
        (current, total) => {
          this.jobsService.updateJob(jobId, {
            status: 'running',
            stage: 'Converting',
            detail: `Converting batch ${current}/${total}…`,
            meta: { current, total },
          });
        },
      );

      const setName = meta.name?.trim() || `${baseName}-converted`;
      const convertedFilename = `${baseName}-converted.csv`;

      const createdSet = await this.testSetModel.create({
        name: setName,
        filename: convertedFilename,
        sizeBytes: null,
        project: meta.project?.trim() || undefined,
      });

      const cases = rows.map((row, index) =>
        this.toStoredTestCase(String(createdSet._id), row, index),
      );

      if (cases.length > 0) {
        await this.testCaseModel.insertMany(cases);
      }

      this.jobsService.updateJob(jobId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        detail: `${cases.length} test cases`,
        meta: {
          testSetId: String(createdSet._id),
          testSetName: createdSet.name,
          filename,
          testCaseCount: cases.length,
          current: cases.length,
          total: cases.length,
        },
      });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.jobsService.updateJob(jobId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        detail: errMsg,
      });
      throw error;
    }
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
      .sort({ updatedAt: -1 })
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

  async updateTestSetName(testSetId: string, name: string): Promise<{ name: string }> {
    const set = await this.testSetModel.findById(testSetId).exec();
    if (!set) {
      throw new NotFoundException('Test set not found');
    }
    const trimmed = String(name ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Name cannot be empty');
    }
    set.name = trimmed;
    await set.save();
    return { name: set.name };
  }

  async deleteTestSet(testSetId: string): Promise<void> {
    const set = await this.testSetModel.findById(testSetId).exec();
    if (!set) {
      throw new NotFoundException('Test set not found');
    }
    const setIdStr = String(set._id);
    const resultSets = await this.resultSetModel
      .find({ testSetId: this.matchStoredId(set._id) })
      .select({ _id: 1 })
      .lean();
    const resultSetIds = resultSets.map((rs) => String(rs._id));

    await this.resultCaseModel.deleteMany({ testSetId: this.matchStoredId(set._id) });
    if (resultSetIds.length > 0) {
      await this.evaluationModel.deleteMany({ resultSetId: { $in: resultSetIds } });
    }
    await this.resultSetModel.deleteMany({ testSetId: this.matchStoredId(set._id) });
    await this.testCaseModel.deleteMany({ testSetId: this.matchStoredId(set._id) });
    await this.testSetModel.findByIdAndDelete(testSetId);
  }

  async getTestSet(testSetId: string) {
    const set = await this.testSetModel.findById(testSetId).lean();
    if (!set) {
      throw new NotFoundException('Test set not found');
    }

    const cases = await this.testCaseModel
      .find({ testSetId: this.matchStoredId(set._id) })
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

    const resultSet = await this.resultSetModel.create({
      testSetId: set._id,
      status: 'running',
      name: `Results - ${set.name}`,
      filename: `results-${set.name}.xlsx`,
      format: 'xlsx',
      testSetName: set.name,
      testSetFilename: set.filename,
    });

    await this.testSetModel.updateOne({ _id: set._id }, { $currentDate: { updatedAt: true } });

    const resultSetId = String(resultSet._id);

    const jobId = this.jobsService.addJob('run_test_set', {
      label: 'Run test set',
      testSetId: String(set._id),
      testSetName: set.name,
      resultSetId,
      total: cases.length,
      current: 0,
    });

    void this.runTestSetBackground(jobId, resultSetId, set, cases);

    return {
      jobId,
      resultSetId,
      testSetId: set._id,
      status: 'running',
      total: cases.length,
    };
  }

  private async runTestSetBackground(
    jobId: string,
    resultSetId: string,
    set: { _id: unknown; name: string; filename?: string },
    cases: TestCase[],
  ) {
    let successCount = 0;
    let failedCount = 0;

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
      this.jobsService.updateJob(jobId, { status: 'running', stage: 'Calling chatbot', detail: `Evaluating case 1/${cases.length}…` });
      let currentIndex = 0;
      for (const testCase of cases) {
        currentIndex++;
        this.jobsService.updateJob(jobId, {
          status: 'running',
          detail: `Evaluating case ${currentIndex}/${cases.length}…`,
          stage: 'Calling chatbot',
          meta: { current: currentIndex, total: cases.length, successCount, failedCount, resultSetId },
        });
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

            this.jobsService.updateJob(jobId, { stage: 'Sending follow-up' });

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

          this.jobsService.updateJob(jobId, { stage: 'Scoring result' });

          const actual = responses.join(responseSeparator);
          const score = await this.scoreService.score(row.input, row.expected, actual);

          this.logger.debug(`Test ${testCase.id}: score=${score.score}`);

          await this.resultCaseModel.create(
            this.toResultCaseDocument(resultSetId, set._id, testCase, {
              actual,
              score: score.score,
              reasoning: score.reasoning,
            }),
          );
          successCount++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await this.resultCaseModel.create(
            this.toResultCaseDocument(resultSetId, set._id, testCase, {
              actual: '',
              score: 0,
              reasoning: `ERROR: ${message}`,
            }),
          );
          failedCount++;
        }
      }

      const rowCount = successCount + failedCount;
      const rowsForExport = await this.getResultSetRowsForExport(resultSetId);
      let resultSizeBytesXlsx: number | undefined;
      try {
        const buf = this.buildRowsFile(rowsForExport, 'xlsx');
        resultSizeBytesXlsx = Buffer.isBuffer(buf) ? buf.length : undefined;
      } catch {
        resultSizeBytesXlsx = undefined;
      }

      await this.resultSetModel.updateOne(
        { _id: resultSetId },
        {
          status: 'completed',
          completedAt: new Date(),
          rowCount,
          resultSizeBytesXlsx,
          sizeBytes: resultSizeBytesXlsx,
          testCaseCount: rowCount,
        },
      );

      void this.evaluateService
        .evaluateResultSet(resultSetId, rowsForExport)
        .catch((err) =>
          this.logger.warn(`Evaluation failed for result set ${resultSetId}:`, err),
        );

      this.jobsService.updateJob(jobId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        detail: `${successCount}/${cases.length} passed`,
        meta: { successCount, failedCount, current: cases.length, total: cases.length, resultSetId },
      });
    } catch (error) {
      const rowCount = successCount + failedCount;
      let resultSizeBytesXlsx: number | undefined;
      try {
        const rowsForExport = await this.getResultSetRowsForExport(resultSetId);
        const buf = this.buildRowsFile(rowsForExport, 'xlsx');
        resultSizeBytesXlsx = Buffer.isBuffer(buf) ? buf.length : undefined;
      } catch {
        resultSizeBytesXlsx = undefined;
      }

      await this.resultSetModel.updateOne(
        { _id: resultSetId },
        { status: 'failed', completedAt: new Date(), rowCount, resultSizeBytesXlsx },
      );

      const errMsg = error instanceof Error ? error.message : String(error);
      this.jobsService.updateJob(jobId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        detail: errMsg,
        meta: { successCount, failedCount, current: rowCount, total: cases.length, resultSetId },
      });
      throw error;
    }
  }

  private async getResultSetRowsForExport(resultSetId: string): Promise<TestRow[]> {
    const cases = await this.resultCaseModel
      .find({ resultSetId })
      .sort({ createdAt: 1 })
      .lean();
    return cases.map((c) => this.resultCaseToRow(c));
  }

  buildRowsFile(rows: TestRow[], format: 'csv' | 'xlsx') {
    if (format === 'xlsx') {
      return this.parserService.toXlsxBuffer(rows, 'Results');
    }
    return this.parserService.toCsvBuffer(rows);
  }

  private matchStoredId(id: unknown) {
    return { $in: [String(id), id] };
  }

  private toStoredTestCase(
    testSetId: string,
    row: TestRow,
    index: number,
    preserveEmptyContext = false,
  ) {
    const { id, input, expected, actual, score, reasoning, ...extras } = row;

    return {
      testSetId,
      id: String(id || index + 1),
      input: String(input),
      expected: String(expected),
      additionalContext:
        preserveEmptyContext || Object.keys(extras).length > 0 ? extras : undefined,
    };
  }

  private toResultCaseDocument(
    resultSetId: string,
    testSetId: unknown,
    testCase: TestCase,
    outcome: { actual: string; score: number; reasoning: string },
  ) {
    return {
      resultSetId,
      testSetId: String(testSetId),
      testCaseId: String(testCase._id),
      id: String(testCase.id),
      input: String(testCase.input),
      expected: String(testCase.expected),
      actual: outcome.actual,
      score: outcome.score,
      reasoning: outcome.reasoning,
      additionalContext: this.getAdditionalContext(testCase.additionalContext),
    };
  }

  private getAdditionalContext(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private resultCaseToRow(resultCase: Partial<ResultCase>): TestRow {
    const extras = this.getAdditionalContext(resultCase.additionalContext) ?? {};

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
    const extras = this.getAdditionalContext(testCase.additionalContext) ?? {};

    return {
      id: String(testCase.id),
      input: String(testCase.input),
      expected: String(testCase.expected),
      ...(extras as Record<string, unknown>),
    };
  }
}

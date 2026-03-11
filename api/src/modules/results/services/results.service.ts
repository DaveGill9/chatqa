import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { TestRow } from 'src/types/row.types';
import { ResultSet } from '../entities/result-set.entity';
import { ResultCase } from '../entities/result-case.entity';
import { ParserService } from '../../parse/parser.service';
import { EvaluateService } from './evaluate.service';

@Injectable()
export class ResultsService {
  constructor(
    @InjectModel(ResultSet.name) private readonly resultSetModel: Model<ResultSet>,
    @InjectModel(ResultCase.name) private readonly resultCaseModel: Model<ResultCase>,
    private readonly parserService: ParserService,
    private readonly evaluateService: EvaluateService,
  ) {}

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
    const set = await this.getResultSetOrThrow(resultSetId);
    const cases = await this.getResultCases(set._id);

    return {
      ...set,
      testCaseCount: cases.length,
      cases,
    };
  }

  async getResultSetEvaluation(resultSetId: string) {
    await this.getResultSetOrThrow(resultSetId);
    return this.evaluateService.getEvaluation(resultSetId);
  }

  async getResultSetRows(resultSetId: string): Promise<TestRow[]> {
    const set = await this.getResultSetOrThrow(resultSetId);
    const cases = await this.getResultCases(set._id);

    return cases.map((c) => this.resultCaseToRow(c));
  }

  buildRowsFile(rows: TestRow[], format: 'csv' | 'xlsx'): Buffer {
    if (format === 'xlsx') {
      return this.parserService.toXlsxBuffer(rows, 'Results');
    }
    return this.parserService.toCsvBuffer(rows);
  }

  private async getResultSetOrThrow(resultSetId: string) {
    const set = await this.resultSetModel.findById(resultSetId).lean();
    if (!set) {
      throw new NotFoundException('Result set not found');
    }
    return set;
  }

  private async getResultCases(resultSetId: unknown) {
    return this.resultCaseModel
      .find({ resultSetId: { $in: [String(resultSetId), resultSetId] } })
      .sort({ createdAt: 1 })
      .lean();
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
}

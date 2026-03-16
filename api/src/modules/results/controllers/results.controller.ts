import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from 'src/modules/users/decorators/public.decorator';
import { ResultsService } from '../services/results.service';

@Public()
@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Get('sets')
  async listResultSets(
    @Query('keywords') keywords?: string,
    @Query('setId') setId?: string,
    @Query('format') format?: 'csv' | 'xlsx',
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.resultsService.listResultSets({
      keywords,
      testSetId: setId?.trim() || undefined,
      format: format === 'csv' || format === 'xlsx' ? format : undefined,
      offset: offset ? parseInt(offset, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 200,
    });
  }

  @Get('sets/:resultSetId')
  async getResultSet(@Param('resultSetId') resultSetId: string) {
    return this.resultsService.getResultSet(resultSetId);
  }

  @Get('sets/:resultSetId/evaluation')
  async getResultSetEvaluation(@Param('resultSetId') resultSetId: string) {
    return this.resultsService.getResultSetEvaluation(resultSetId);
  }

  // Download a result set as a CSV or Excel file.
  @Get('sets/:resultSetId/download')
  async downloadResultSet(
    @Param('resultSetId') resultSetId: string,
    @Query('format') format: 'csv' | 'xlsx' = 'xlsx',
    @Res() res: Response,
  ) {
    const rows = await this.resultsService.getResultSetRows(resultSetId);
    const safeFormat: 'csv' | 'xlsx' = format === 'csv' ? 'csv' : 'xlsx';
    const fileBuffer = this.resultsService.buildRowsFile(rows, safeFormat);
    const filename = `result-set-${resultSetId}.${safeFormat}`;

    res.setHeader(
      'Content-Type',
      safeFormat === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fileBuffer);
  }
}

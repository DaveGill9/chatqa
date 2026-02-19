import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Express, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/modules/users/decorators/public.decorator';
import { TestsService } from '../services/tests.service';

@Public()
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTestSet(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string; project?: string },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileExtension = (file.originalname.split('.').pop() || '').trim().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
      throw new BadRequestException('Only CSV and Excel files are supported');
    }

    return this.testsService.uploadTestSet(file, body);
  }

  @Get('sets')
  async listTestSets(
    @Query('keywords') keywords?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.testsService.listTestSets({
      keywords,
      offset: offset ? parseInt(offset, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 200,
    });
  }

  @Get('sets/:testSetId')
  async getTestSet(@Param('testSetId') testSetId: string) {
    return this.testsService.getTestSet(testSetId);
  }

  @Post('sets/:testSetId/run')
  async runTestSet(@Param('testSetId') testSetId: string) {
    return this.testsService.runTestSet(testSetId);
  }

  @Get('sets/:testSetId/runs')
  async listRunsForSet(@Param('testSetId') testSetId: string) {
    return this.testsService.listRunsForSet(testSetId);
  }

  @Get('runs/:testRunId')
  async getRun(@Param('testRunId') testRunId: string) {
    return this.testsService.getRun(testRunId);
  }

  @Get('runs/:testRunId/results')
  async getRunResults(@Param('testRunId') testRunId: string) {
    const rows = await this.testsService.getRunRows(testRunId);
    return { rows };
  }

  @Get('runs/:testRunId/download')
  async downloadRunResults(
    @Param('testRunId') testRunId: string,
    @Query('format') format: 'csv' | 'xlsx' = 'xlsx',
    @Res() res: Response,
  ) {
    const rows = await this.testsService.getRunRows(testRunId);
    const safeFormat: 'csv' | 'xlsx' = format === 'csv' ? 'csv' : 'xlsx';
    const fileBuffer = this.testsService.buildRowsFile(rows, safeFormat);
    const filename = `test-run-${testRunId}-results.${safeFormat}`;

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

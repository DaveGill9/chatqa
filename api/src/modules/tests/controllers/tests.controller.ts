import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Express } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Public } from 'src/modules/users/decorators/public.decorator';
import { TestsService } from '../services/tests.service';

@Public()
@Controller('tests')
export class TestsController {
  constructor(private readonly testsService: TestsService) {}

  private validateUploadedSpreadsheet(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const fileExtension = (file.originalname.split('.').pop() || '')
      .trim()
      .toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(fileExtension)) {
      throw new BadRequestException('Only CSV and Excel files are supported');
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  // Store an uploaded spreadsheet as a reusable test set.
  async uploadTestSet(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string; project?: string },
  ) {
    this.validateUploadedSpreadsheet(file);

    return this.testsService.uploadTestSet(file, body);
  }

  @Post('convert')
  @UseInterceptors(FileInterceptor('file'))
  // Convert raw spreadsheet rows into test cases and queue the import.
  async convertAndUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { name?: string; project?: string; prompt?: string },
  ) {
    this.validateUploadedSpreadsheet(file);

    return this.testsService.convertAndUpload(file, {
      name: body.name,
      project: body.project,
      prompt: body.prompt,
    });
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

  @Patch('sets/:testSetId')
  async updateTestSet(
    @Param('testSetId') testSetId: string,
    @Body() body: { name?: string },
  ) {
    return this.testsService.updateTestSetName(testSetId, body.name ?? '');
  }

  @Delete('sets/:testSetId')
  async deleteTestSet(@Param('testSetId') testSetId: string) {
    await this.testsService.deleteTestSet(testSetId);
  }

  // Start an asynchronous run for every case in a test set.
  @Post('sets/:testSetId/run')
  async runTestSet(@Param('testSetId') testSetId: string) {
    return this.testsService.runTestSet(testSetId);
  }
}

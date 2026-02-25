import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../users/decorators/public.decorator';
import { JobsService } from './jobs.service';
import type { Job } from './types';

@Public()
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  listJobs() {
    return this.jobsService.listJobs();
  }

  @Get('stream')
  streamJobs(@Res() res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial state of all jobs
    const jobs = this.jobsService.listJobs();
    for (const job of jobs) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
    }

    const unsubscribe = this.jobsService.subscribe((job: Job) => {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
    });

    res.on('close', () => {
      unsubscribe();
    });
  }
}

import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type { Job, JobStatus, JobType } from './types';

const MAX_JOBS = 100;

@Injectable()
export class JobsService extends EventEmitter {
  private jobs = new Map<string, Job>();

  // Create an in-memory job entry and broadcast its initial state.
  addJob(type: JobType, meta: Partial<Job['meta']> & { label: string }): string {
    const id = randomUUID();
    const job: Job = {
      id,
      type,
      label: meta.label,
      status: 'queued',
      createdAt: new Date().toISOString(),
      meta: { ...meta },
    };
    this.jobs.set(id, job);
    this.trimJobs();
    this.emitJob(id, job);
    return id;
  }

  // Merge job progress updates and notify subscribers of the latest state.
  updateJob(id: string, update: Partial<Pick<Job, 'status' | 'detail' | 'stage' | 'completedAt'>> & { meta?: Partial<Job['meta']> }): void {
    const job = this.jobs.get(id);
    if (!job) return;
    if (update.status) job.status = update.status;
    if (update.detail !== undefined) job.detail = update.detail;
    if (update.stage !== undefined) job.stage = update.stage;
    if (update.completedAt) job.completedAt = update.completedAt;
    if (update.meta) job.meta = { ...job.meta, ...update.meta };
    this.emitJob(id, job);
  }

  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  listJobs(limit = 50): Job[] {
    const list = Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list.slice(0, limit);
  }

  // Register a listener for live job status updates.
  subscribe(callback: (job: Job) => void): () => void {
    const handler = (payload: { id: string; job: Job }) => callback(payload.job);
    this.on('job', handler);
    return () => this.off('job', handler);
  }

  private emitJob(id: string, job: Job): void {
    this.emit('job', { id, job });
  }

  private trimJobs(): void {
    if (this.jobs.size <= MAX_JOBS) return;
    const sorted = Array.from(this.jobs.entries())
      .sort(([, a], [, b]) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const toRemove = sorted.slice(0, this.jobs.size - MAX_JOBS);
    for (const [id] of toRemove) {
      this.jobs.delete(id);
    }
  }
}

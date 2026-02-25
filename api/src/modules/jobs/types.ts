export type JobType = 'run_test_set' | 'convert_format';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  label: string;
  status: JobStatus;
  detail?: string;
  stage?: string; // e.g. "Calling chatbot", "Sending follow-up", "Scoring result"
  createdAt: string; // ISO string
  completedAt?: string; // ISO string
  meta?: {
    testSetId?: string;
    testSetName?: string;
    testRunId?: string;
    filename?: string;
    current?: number;
    total?: number;
    successCount?: number;
    failedCount?: number;
    testCaseCount?: number;
  };
}

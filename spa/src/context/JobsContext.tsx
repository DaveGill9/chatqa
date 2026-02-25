import { createContext, useContext } from 'react';

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type JobType = 'run_test_set' | 'convert_format';

export interface Job {
  id: string;
  type: JobType;
  label: string;
  status: JobStatus;
  detail?: string;
  createdAt: string;
  completedAt?: string;
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

export interface JobsContextType {
  jobs: Job[];
}

export const JobsContext = createContext<JobsContextType | undefined>(undefined);

export const useJobs = (): JobsContextType => {
  const context = useContext(JobsContext);
  if (context === undefined) {
    throw new Error('useJobs must be used within a JobsProvider');
  }
  return context;
};

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { JobsContext, type Job } from './JobsContext';
import apiClient from '../services/api-client';

function getJobsStreamUrl(): string {
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
  return `${base}/jobs/stream`;
}

export const JobsProvider = ({ children }: { children: ReactNode }) => {
  const [jobs, setJobs] = useState<Job[]>([]);

  // Merge incoming job updates by id while keeping the newest jobs first.
  const mergeJob = useCallback((job: Job) => {
    setJobs((prev) => {
      const map = new Map(prev.map((j) => [j.id, j]));
      map.set(job.id, job);
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
  }, []);

  useEffect(() => {
    apiClient
      .get<Job[]>('/jobs')
      .then((res) => setJobs(res.data ?? []))
      .catch(() => {});

    const url = getJobsStreamUrl();
    const es = new EventSource(url);

    es.onmessage = (e) => {
      try {
        const job = JSON.parse(e.data) as Job;
        mergeJob(job);
      } catch {
        // ignore malformed
      }
    };

    es.onerror = () => {
      es.close();
    };

    return () => es.close();
  }, [mergeJob]);

  return (
    <JobsContext.Provider value={{ jobs }}>
      {children}
    </JobsContext.Provider>
  );
};

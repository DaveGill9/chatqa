import { format } from 'date-fns';
import Icon from '../icon/Icon';
import styles from './Navigation.module.scss';
import SettingsMenu from './SettingsMenu';
import { classList } from '../../utils';
import { useJobs, type Job } from '../../context/JobsContext';

function getJobSubtitle(job: Job): string {
  if (job.status === 'queued') return 'Queued';
  if (job.status === 'running') return job.stage ?? 'In progress';
  if (job.completedAt) {
    return `Finished ${format(new Date(job.completedAt), 'MMM d, h:mm a')}`;
  }
  return format(new Date(job.createdAt), 'MMM d, h:mm a');
}

function getJobTitle(job: Job): string {
  if (job.type === 'run_test_set' && job.meta?.testSetName) {
    return `Run test set ${job.meta.testSetName}`;
  }
  if (job.type === 'convert_format' && job.meta?.filename) {
    return `Convert: ${job.meta.filename}`;
  }
  return job.label;
}

function JobCardItem({ job }: { job: Job }) {
  const statusIcon =
    job.status === 'running' ? 'progress_activity' :
    job.status === 'completed' ? 'check_circle' :
    job.status === 'failed' ? 'error' :
    'schedule';

  return (
    <div className={[styles.jobCard, styles[`jobStatus_${job.status}`]].join(' ')}>
      <div className={styles.jobCardIcon}>
        <Icon name={statusIcon} />
      </div>
      <div className={styles.jobCardBody}>
        <span className={styles.jobCardLabel}>{getJobTitle(job)}</span>
        {job.type === 'run_test_set' && job.meta?.testRunId && (
          <span className={styles.jobCardRunId}>{job.meta.testRunId}</span>
        )}
        {job.detail && <span className={styles.jobCardDetail}>{job.detail}</span>}
        <span className={styles.jobCardTime}>{getJobSubtitle(job)}</span>
      </div>
    </div>
  );
}

const Navigation = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const classNames = classList(styles.navigation, className);
  const { jobs } = useJobs();

  return (
    <nav className={classNames} {...props}>
      <div className={styles.logo}>
        <span>ChatQA</span>
      </div>

      <div className={styles.jobQueue}>
        <h2 className={styles.jobQueueTitle}>Jobs</h2>
        <div className={styles.jobCardList}>
          {jobs.slice(0, 10).map((job) => (
            <JobCardItem key={job.id} job={job} />
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <SettingsMenu />
      </div>
    </nav>
  );
};

export default Navigation;

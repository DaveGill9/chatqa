import { formatDistanceToNow } from 'date-fns';
import Icon from '../icon/Icon';
import styles from './Navigation.module.scss';
import SettingsMenu from './SettingsMenu';
import { classList } from '../../utils';
import { useJobs, type Job } from '../../context/JobsContext';

function formatJobTimestamp(job: Job): string {
  const date = job.completedAt ? new Date(job.completedAt) : new Date(job.createdAt);
  if (job.status === 'queued' || job.status === 'running') {
    return job.status === 'running' ? 'In progress' : 'Queued';
  }
  return formatDistanceToNow(date, { addSuffix: true });
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
        <span className={styles.jobCardLabel}>{job.label}</span>
        {job.detail && <span className={styles.jobCardDetail}>{job.detail}</span>}
        <span className={styles.jobCardTime}>{formatJobTimestamp(job)}</span>
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

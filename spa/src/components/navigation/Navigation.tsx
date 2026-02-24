import Icon from '../icon/Icon';
import styles from './Navigation.module.scss';
import SettingsMenu from './SettingsMenu';
import { classList } from '../../utils';

type JobStatus = 'running' | 'completed' | 'failed' | 'queued';

type JobCard = {
  id: string;
  label: string;
  status: JobStatus;
  detail?: string;
  timestamp: string;
};

// Hard-coded job cards for placeholder. Will be replaced with live job queue.
const MOCK_JOBS: JobCard[] = [
  { id: '1', label: 'Run test set', status: 'running', detail: 'Evaluating case 12/45…', timestamp: '2m ago' },
  { id: '2', label: 'Run test set', status: 'completed', detail: '42/45 passed', timestamp: '8m ago' },
  { id: '3', label: 'Upload test set', status: 'completed', detail: 'NLA Testing 1.xlsx', timestamp: '15m ago' },
  { id: '4', label: 'Run test set', status: 'failed', detail: 'Connection timeout', timestamp: '1h ago' },
  { id: '5', label: 'Run test set', status: 'queued', detail: 'Waiting…', timestamp: '—' },
];

function JobCardItem({ job }: { job: JobCard }) {
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
        <span className={styles.jobCardTime}>{job.timestamp}</span>
      </div>
    </div>
  );
}

const Navigation = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const classNames = classList(styles.navigation, className);

  return (
    <nav className={classNames} {...props}>
      <div className={styles.logo}>
        <span>ChatQA</span>
      </div>

      <div className={styles.jobQueue}>
        <h2 className={styles.jobQueueTitle}>Jobs</h2>
        <div className={styles.jobCardList}>
          {MOCK_JOBS.slice(0, 10).map((job) => (
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

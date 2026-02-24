import { NavLink } from 'react-router-dom';
import Icon from '../icon/Icon';
import styles from './Navigation.module.scss';
import SettingsMenu from './SettingsMenu';
import { classList } from '../../utils';

const Navigation = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  const classNames = classList(styles.navigation, className);
  const disableAuth = import.meta.env.VITE_DISABLE_AUTH === 'true';

  const activeClassName = ({ isActive }: { isActive: boolean }) => (isActive ? styles.active : '');

  return (
    <nav className={classNames} {...props}>
      <div className={styles.logo}>
        <span>ChatQA</span>
      </div>

      <div className={styles.menu}>
        <NavLink to="/tests" className={activeClassName}>
          <Icon name="task_alt" />
          Tests
        </NavLink>

        <NavLink to="/results" className={activeClassName}>
          <Icon name="query_stats" />
          Results
        </NavLink>

        {!disableAuth && (
          <NavLink to="/logs" className={activeClassName}>
            <Icon name="bug_report" />
            Logs
          </NavLink>
        )}
      </div>

      <div className={styles.spacer} />

      <div className={styles.footer}>
        <SettingsMenu />
      </div>
    </nav>
  );
};

export default Navigation;

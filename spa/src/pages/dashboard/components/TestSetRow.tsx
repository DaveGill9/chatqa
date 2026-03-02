import { AnimatePresence, motion } from 'framer-motion';
import { format } from 'date-fns';
import Icon from '../../../components/icon/Icon';
import Popover from '../../../components/popover/Popover';
import { stripFileExtension } from '../../../utils';
import type { ResultSet, TestSet } from '../types';
import styles from '../DashboardPage.module.scss';

interface TestSetRowProps {
  testSet: TestSet;
  runs: ResultSet[];
  isExpanded: boolean;
  isEditing: boolean;
  isMenuOpen: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onPreview: (id: string) => void;
  onRun: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRename: (id: string, newName: string, currentName: string) => void;
  onCancelEdit: () => void;
  onViewResult: (resultSetId: string) => void;
  onMenuToggle: (id: string | null) => void;
}

export default function TestSetRow({
  testSet,
  runs,
  isExpanded,
  isEditing,
  isMenuOpen,
  onToggleExpand,
  onEdit,
  onPreview,
  onRun,
  onRequestDelete,
  onRename,
  onCancelEdit,
  onViewResult,
  onMenuToggle,
}: TestSetRowProps) {
  return (
    <div className={styles.testSetRow}>
      <div
        className={styles.testSetMain}
        onClick={() => onToggleExpand(testSet._id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggleExpand(testSet._id)}
        aria-expanded={isExpanded}
      >
        <button
          type="button"
          className={styles.expandBtn}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(testSet._id);
          }}
          aria-label={isExpanded ? 'Collapse' : 'Expand runs'}
        >
          <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
        </button>
        <div className={styles.titleCell}>
          {isEditing ? (
            <input
              type="text"
              className={styles.titleInput}
              defaultValue={stripFileExtension(testSet.name)}
              autoFocus
              onBlur={(e) => onRename(testSet._id, e.target.value, testSet.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  onCancelEdit();
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <strong>{stripFileExtension(testSet.name)}</strong>
          )}
        </div>
        <div className={styles.countCell}>{testSet.testCaseCount ?? 0}</div>
        <div className={styles.statusCell}>
          {runs.length === 0 ? 'No runs' : `${runs.length} run${runs.length === 1 ? '' : 's'}`}
        </div>
        <div className={styles.dateCell}>{format(new Date(testSet.createdAt), 'h:mma d MMM yyyy')}</div>
        <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
          <Popover
            menu={
              <ul className={styles.actionsMenu}>
                <li>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      onEdit(testSet._id);
                      onMenuToggle(null);
                    }}
                  >
                    <Icon name="edit" /> Rename
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      onPreview(testSet._id);
                      onMenuToggle(null);
                    }}
                  >
                    <Icon name="visibility" /> Preview
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={() => {
                      void onRun(testSet._id);
                      onMenuToggle(null);
                    }}
                  >
                    <Icon name="play_arrow" /> Run
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={() => {
                      onRequestDelete(testSet._id);
                      onMenuToggle(null);
                    }}
                  >
                    <Icon name="delete" /> Delete
                  </button>
                </li>
              </ul>
            }
            visible={isMenuOpen}
            setVisible={(v) => onMenuToggle(v ? testSet._id : null)}
            position="bottom"
            anchor="right"
            className={styles.actionsPopover}
          >
            <button
              type="button"
              className={styles.menuTrigger}
              aria-label={`Actions for ${stripFileExtension(testSet.name)}`}
              aria-expanded={isMenuOpen}
            >
              <Icon name="more_vert" />
            </button>
          </Popover>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className={styles.runsBox}>
              <div className={styles.runsTable}>
                <div className={styles.runsTableHeader}>
                  <span className={styles.runsTableIcon} />
                  <span className={styles.runsTableCol}>Run ID</span>
                  <span className={styles.runsTableCol}>Date run</span>
                </div>
                {runs.length === 0 ? (
                  <div className={styles.noRuns}>No runs yet</div>
                ) : (
                  runs.map((run) => (
                    <button
                      key={run._id}
                      type="button"
                      className={styles.runItem}
                      onClick={() => onViewResult(run._id)}
                    >
                      <span className={styles.runIcon}>
                        <Icon name="description" />
                      </span>
                      <span className={styles.runId}>{String(run._id).slice(0, 8)}</span>
                      <span className={styles.runDate}>{format(new Date(run.createdAt), 'h:mma d MMM yyyy')}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

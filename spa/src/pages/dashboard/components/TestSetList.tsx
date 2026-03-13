import Feedback from '../../../components/feedback/Feedback';
import type { ResultSet, SortKey, SortDirection, TestSet } from '../types';
import DashboardControls from './DashboardControls';
import TestSetRow from './TestSetRow';
import styles from '../DashboardPage.module.scss';

interface TestSetListProps {
  sortedTestSets: TestSet[];
  runsByTestSet: Map<string, ResultSet[]>;
  sortKey: SortKey;
  sortDirection: SortDirection;
  expandedSetId: string | null;
  editingSetId: string | null;
  openMenuSetId: string | null;
  keywords: string;
  uploading: boolean;
  loading: boolean;
  onSearch: (keywords: string) => void;
  onConvert: () => void;
  onUpload: () => void;
  onToggleSort: (key: SortKey) => void;
  onToggleExpand: (id: string) => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onPreview: (id: string) => void;
  onRun: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRename: (id: string, newName: string, currentName: string) => void;
  onViewResult: (resultSetId: string) => void;
  onMenuToggle: (id: string | null) => void;
}

function sortIndicator(sortKey: SortKey, currentKey: SortKey, direction: SortDirection) {
  if (currentKey !== sortKey) return null;
  return <span className={styles.sortIndicator}>{direction === 'asc' ? '▲' : '▼'}</span>;
}

export default function TestSetList({
  sortedTestSets,
  runsByTestSet,
  sortKey,
  sortDirection,
  expandedSetId,
  editingSetId,
  openMenuSetId,
  keywords,
  uploading,
  loading,
  onSearch,
  onConvert,
  onUpload,
  onToggleSort,
  onToggleExpand,
  onEdit,
  onCancelEdit,
  onPreview,
  onRun,
  onRequestDelete,
  onRename,
  onViewResult,
  onMenuToggle,
}: TestSetListProps) {
  return (
    <div className={styles.list}>
      <DashboardControls
        keywords={keywords}
        onSearch={onSearch}
        onConvert={onConvert}
        onUpload={onUpload}
        uploading={uploading}
      />

      {uploading && <Feedback type="loading">Uploading test file...</Feedback>}
      {loading && !uploading && <Feedback type="loading" />}
      {!loading && !uploading && sortedTestSets.length === 0 && (
        <Feedback type="empty">No test sets found. Upload one to get started.</Feedback>
      )}

      <div className={styles.listCard}>
        {!!sortedTestSets.length && (
          <div className={styles.listHeader} role="row">
            <span className={styles.headerSpacer} />
            <button
              type="button"
              className={[styles.headerButton, styles.headerTitle].join(' ')}
              onClick={() => onToggleSort('name')}
              aria-label="Sort by title"
            >
              Title {sortIndicator('name', sortKey, sortDirection)}
            </button>
            <button
              type="button"
              className={[styles.headerButton, styles.countCell].join(' ')}
              onClick={() => onToggleSort('testCaseCount')}
              aria-label="Sort by tests"
            >
              Tests {sortIndicator('testCaseCount', sortKey, sortDirection)}
            </button>
            <span className={styles.headerStatus} aria-hidden>
              Status
            </span>
            <button
              type="button"
              className={[styles.headerButton, styles.dateCell].join(' ')}
              onClick={() => onToggleSort('updatedAt')}
              aria-label="Sort by modified date"
            >
              Modified {sortIndicator('updatedAt', sortKey, sortDirection)}
            </button>
            <span className={styles.headerActions} aria-hidden>
              Actions
            </span>
          </div>
        )}

        {sortedTestSets.map((testSet) => {
          const runs = runsByTestSet.get(testSet._id) ?? [];
          return (
            <TestSetRow
              key={testSet._id}
              testSet={testSet}
              runs={runs}
              isExpanded={expandedSetId === testSet._id}
              isEditing={editingSetId === testSet._id}
              isMenuOpen={openMenuSetId === testSet._id}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onPreview={onPreview}
              onRun={onRun}
              onRequestDelete={onRequestDelete}
              onRename={onRename}
              onCancelEdit={onCancelEdit}
              onViewResult={onViewResult}
              onMenuToggle={onMenuToggle}
            />
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import usePagedRequest from '../../hooks/usePagedRequest';
import useFetchRequest from '../../hooks/useFetchRequest';
import Feedback from '../../components/feedback/Feedback';
import Icon from '../../components/icon/Icon';
import Page from '../../components/layout/Page';
import AnimatedDetailLayout from '../../components/layout/AnimatedDetailLayout';
import Input from '../../components/input/Input';
import Button from '../../components/button/Button';
import ConvertFormatDialog from './ConvertFormatDialog';
import { addSearchParams } from '../../utils';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import styles from './DashboardPage.module.scss';

type TestSet = {
  _id: string;
  name: string;
  filename: string;
  sizeBytes?: number | null;
  project?: string | null;
  createdAt: string;
  testCaseCount?: number;
};

type TestCase = {
  _id: string;
  id: string;
  input: string;
  expected: string;
  additionalContext?: Record<string, unknown>;
};

type TestSetDetail = TestSet & {
  testCaseCount: number;
  cases: TestCase[];
};

type ResultSet = {
  _id: string;
  testRunId: string;
  testSetId: string;
  name: string;
  createdAt: string;
  filename: string;
  format: 'csv' | 'xlsx';
  sizeBytes?: number | null;
  testCaseCount?: number;
  testSetName?: string | null;
  testSetFilename?: string | null;
};

type SortKey = 'createdAt' | 'name' | 'testCaseCount';
type SortDirection = 'asc' | 'desc';

const stripFileExtension = (str: string) => {
  if (!str || typeof str !== 'string') return str;
  const lastDot = str.lastIndexOf('.');
  return lastDot > 0 ? str.slice(0, lastDot) : str;
};

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setIdFromUrl = searchParams.get('setId');

  const [keywords, setKeywords] = useState('');
  const [uploading, setUploading] = useState(false);
  const [convertDialogVisible, setConvertDialogVisible] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  const [appliedKeywords, setAppliedKeywords] = useState('');
  const testSetsUrl = addSearchParams('/tests/sets', appliedKeywords ? { keywords: appliedKeywords } : {});
  const { data: testSetsData, setData: setTestSetsData, loading: testSetsLoading } = usePagedRequest<TestSet>(testSetsUrl, { limit: 200 });

  const { data: resultSetsData, loading: resultSetsLoading, reset: resetResultSets } = usePagedRequest<ResultSet>('/tests/results/sets', { limit: 500 });

  useEffect(() => {
    if (setIdFromUrl) {
      setExpandedSetId(setIdFromUrl);
    }
  }, [setIdFromUrl]);

  const runsByTestSet = useMemo(() => {
    const map = new Map<string, ResultSet[]>();
    (resultSetsData ?? []).forEach((rs) => {
      const list = map.get(rs.testSetId) ?? [];
      list.push(rs);
      map.set(rs.testSetId, list);
    });
    map.forEach((list) => list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    return map;
  }, [resultSetsData]);

  const sortedTestSets = useMemo(() => {
    const list = (testSetsData ?? []).slice();
    const direction = sortDirection === 'asc' ? 1 : -1;
    const compareText = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });
    const compareNumber = (a: number, b: number) => a - b;

    list.sort((a, b) => {
      switch (sortKey) {
        case 'createdAt': {
          const av = new Date(a.createdAt).getTime();
          const bv = new Date(b.createdAt).getTime();
          return direction * compareNumber(av, bv);
        }
        case 'name': {
          const base = compareText(a.name, b.name);
          return direction * (base || compareText(a.filename, b.filename));
        }
        case 'testCaseCount': {
          const av = a.testCaseCount ?? 0;
          const bv = b.testCaseCount ?? 0;
          return direction * (compareNumber(av, bv) || compareText(a.name, b.name));
        }
        default:
          return 0;
      }
    });
    return list;
  }, [testSetsData, sortDirection, sortKey]);

  const toggleSort = (nextKey: SortKey) => {
    if (nextKey === sortKey) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === 'createdAt' ? 'desc' : 'asc');
  };

  const sortIndicator = (key: SortKey) => {
    if (key !== sortKey) return null;
    return <span className={styles.sortIndicator}>{sortDirection === 'asc' ? '▲' : '▼'}</span>;
  };

  const toggleExpand = (testSetId: string) => {
    setExpandedSetId((prev) => (prev === testSetId ? null : testSetId));
  };

  const handlePreview = (e: React.MouseEvent, testSetId: string) => {
    e.stopPropagation();
    setSelectedSetId(testSetId);
    setPreviewVisible(true);
  };

  const handleRun = async (e: React.MouseEvent, testSetId: string) => {
    e.stopPropagation();
    try {
      const response = await apiClient.post(`/tests/sets/${testSetId}/run`);
      const result = response.data as {
        testRunId: string;
        testSetId: string;
        status: string;
        total: number;
        successCount: number;
        failedCount: number;
      };
      toast.success(`Run completed: ${result.successCount}/${result.total} passed (${result.failedCount} failed)`);
      resetResultSets();
      setExpandedSetId(testSetId);
    } catch (error) {
      toast.error(error);
    }
  };

  const handleViewResult = (resultSetId: string) => {
    navigate(`/results/${resultSetId}`);
  };

  const handleRename = async (testSetId: string, newName: string, currentName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === stripFileExtension(currentName)) {
      setEditingSetId(null);
      return;
    }
    try {
      const response = await apiClient.patch(`/tests/sets/${testSetId}`, { name: trimmed });
      const updated = response.data as { name: string };
      setTestSetsData((prev) => {
        if (!prev) return prev;
        return prev.map((s) =>
          s._id === testSetId ? { ...s, name: updated.name } : s,
        );
      });
      toast.success('Test set renamed');
    } catch (error) {
      toast.error(error);
    } finally {
      setEditingSetId(null);
    }
  };

  const handleSearch = () => {
    setAppliedKeywords(keywords.trim());
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const response = await apiClient.post('/tests/upload', formData);
      const created = response.data as {
        testSetId: string;
        name: string;
        filename: string;
        sizeBytes?: number | null;
        project?: string | null;
        testCaseCount?: number;
      };
      setTestSetsData((prev) => {
        const next = prev ? [...prev] : [];
        next.unshift({
          _id: created.testSetId,
          name: created.name,
          filename: created.filename,
          sizeBytes: created.sizeBytes ?? null,
          project: created.project ?? null,
          createdAt: new Date().toISOString(),
          testCaseCount: created.testCaseCount ?? 0,
        });
        return next;
      });
      toast.success('Test file uploaded');
    } catch (error) {
      toast.error(error);
    } finally {
      setUploading(false);
    }
  };

  const selectFiles = () => {
    const file = document.createElement('input');
    file.type = 'file';
    file.multiple = false;
    file.accept = '.csv,.xlsx,.xls';
    file.onchange = (event) => {
      const selected = (event.target as HTMLInputElement).files;
      if (selected && selected.length > 0) {
        void uploadFile(selected[0]);
      }
    };
    file.click();
  };

  const handleConverted = (created: { testSetId: string; name: string; filename?: string; testCaseCount: number }) => {
    setTestSetsData((prev) => {
      const next = prev ? [...prev] : [];
      next.unshift({
        _id: created.testSetId,
        name: created.name,
        filename: created.filename ?? `${created.name}.csv`,
        sizeBytes: null,
        project: null,
        createdAt: new Date().toISOString(),
        testCaseCount: created.testCaseCount ?? 0,
      });
      return next;
    });
  };

  return (
    <Page>
      <Page.Header
        title="Dashboard"
        subtitle="Upload test sets, run tests, and view results."
      />

      <Page.Content>
        <div className={styles.layout}>
          <div className={styles.list}>
            {uploading && <Feedback type="loading">Uploading test file...</Feedback>}
            {(testSetsLoading || resultSetsLoading) && !uploading && <Feedback type="loading" />}
            {!testSetsLoading && !resultSetsLoading && testSetsData?.length === 0 && (
              <Feedback type="empty">No test sets found. Upload one to get started.</Feedback>
            )}

            <div className={styles.controlsBar}>
              <div className={styles.searchWrap}>
                <Icon name="search" />
                <Input
                  type="search"
                  placeholder="Search test sets"
                  value={keywords}
                  onTextChange={setKeywords}
                  onEnter={handleSearch}
                  className={styles.searchInput}
                />
              </div>
              <Button type="button" className={styles.uploadButton} onClick={() => setConvertDialogVisible(true)} disabled={uploading}>
                <Icon name="swap_horiz" /> Convert format
              </Button>
              <Button type="button" className={styles.uploadButton} onClick={selectFiles} disabled={uploading}>
                <Icon name="upload" /> {uploading ? 'Uploading…' : 'Upload Test Set'}
              </Button>
            </div>

            <div className={styles.listCard}>
              {!!sortedTestSets.length && (
                <div className={styles.listHeader} role="row">
                  <span className={styles.headerSpacer} />
                  <button type="button" className={[styles.headerButton, styles.headerTitle].join(' ')} onClick={() => toggleSort('name')} aria-label="Sort by title">
                    Title {sortIndicator('name')}
                  </button>
                  <button type="button" className={[styles.headerButton, styles.countCell].join(' ')} onClick={() => toggleSort('testCaseCount')} aria-label="Sort by tests">
                    Tests {sortIndicator('testCaseCount')}
                  </button>
                  <button type="button" className={[styles.headerButton, styles.dateCell].join(' ')} onClick={() => toggleSort('createdAt')} aria-label="Sort by date">
                    Added {sortIndicator('createdAt')}
                  </button>
                  <span className={styles.headerStatus} aria-hidden>Status</span>
                  <span className={styles.headerActions} aria-hidden>Actions</span>
                </div>
              )}

              {sortedTestSets.map((testSet) => {
                const runs = runsByTestSet.get(testSet._id) ?? [];
                const isExpanded = expandedSetId === testSet._id;
                return (
                  <div key={testSet._id} className={styles.testSetRow}>
                    <div
                      className={styles.testSetMain}
                      onClick={() => toggleExpand(testSet._id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && toggleExpand(testSet._id)}
                      aria-expanded={isExpanded}
                    >
                      <button
                        type="button"
                        className={styles.expandBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleExpand(testSet._id);
                        }}
                        aria-label={isExpanded ? 'Collapse' : 'Expand runs'}
                      >
                        <Icon name={isExpanded ? 'expand_less' : 'expand_more'} />
                      </button>
                      <div className={styles.titleCell}>
                        {editingSetId === testSet._id ? (
                          <input
                            type="text"
                            className={styles.titleInput}
                            defaultValue={stripFileExtension(testSet.name)}
                            autoFocus
                            onBlur={(e) => handleRename(testSet._id, e.target.value, testSet.name)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.currentTarget.blur();
                              }
                              if (e.key === 'Escape') {
                                setEditingSetId(null);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <button
                            type="button"
                            className={styles.titleButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSetId(testSet._id);
                            }}
                          >
                            <strong>{stripFileExtension(testSet.name)}</strong>
                            <span className={styles.titlePen} aria-hidden>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                              </svg>
                            </span>
                          </button>
                        )}
                      </div>
                      <div className={styles.countCell}>{testSet.testCaseCount ?? 0}</div>
                      <div className={styles.dateCell}>{format(new Date(testSet.createdAt), 'h:mma d MMM yyyy')}</div>
                      <div className={styles.statusCell}>
                        {runs.length === 0 ? 'No runs' : `${runs.length} run${runs.length === 1 ? '' : 's'}`}
                      </div>
                      <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                        <Button type="button" variant="accent" className={styles.rowBtn} onClick={(e) => handleRun(e, testSet._id)}>
                          Run
                        </Button>
                        <Button type="button" variant="border" className={styles.rowBtn} onClick={(e) => handlePreview(e, testSet._id)}>
                          Preview
                        </Button>
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
                                    onClick={() => handleViewResult(run._id)}
                                  >
                                    <span className={styles.runIcon}><Icon name="description" /></span>
                                    <span className={styles.runId}>{run.testRunId}</span>
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
              })}
            </div>
          </div>

          <ConvertFormatDialog
            visible={convertDialogVisible}
            onClose={() => setConvertDialogVisible(false)}
            onConverted={handleConverted}
          />
          <AnimatePresence>
            {previewVisible && selectedSetId && (
              <AnimatedDetailLayout
                width={760}
                onClose={() => {
                  setPreviewVisible(false);
                  setSelectedSetId(null);
                }}
              >
                <TestSetPreview
                  testSetId={selectedSetId}
                  onClose={() => {
                    setPreviewVisible(false);
                    setSelectedSetId(null);
                  }}
                />
              </AnimatedDetailLayout>
            )}
          </AnimatePresence>
        </div>
      </Page.Content>
    </Page>
  );
}

interface TestSetPreviewProps {
  testSetId: string | null;
  onClose: () => void;
}

function TestSetPreview({ testSetId, onClose }: TestSetPreviewProps) {
  const { data, loading } = useFetchRequest<TestSetDetail>(testSetId ? `/tests/sets/${testSetId}` : '');

  return (
    <aside className={styles.preview}>
      <div className={styles.previewHeader}>
        <strong>{stripFileExtension(data?.filename || data?.name || '')}</strong>
        <Button type="button" variant="border" onClick={onClose} aria-label="Close">
          Close
        </Button>
      </div>
      <div className={styles.previewContent}>
        {!testSetId && <Feedback type="empty">Select a test file to preview</Feedback>}
        {loading && testSetId && <Feedback type="loading" />}
        {!loading && data && (
          <>
            {data.cases?.length === 0 && <Feedback type="empty">No test rows found</Feedback>}
            {(data.cases ?? []).map((testCase) => {
              const extras = testCase.additionalContext ?? {};
              const extraEntries = Object.entries(extras).filter(([, v]) => v != null && v !== '');
              return (
                <article className={styles.caseCard} key={testCase._id}>
                  <h3>{testCase.id}</h3>
                  <p>
                    <b>Input:</b> {testCase.input}
                  </p>
                  <p>
                    <b>Expected:</b> {testCase.expected}
                  </p>
                  {extraEntries.length > 0 && extraEntries.map(([key, val]) => (
                    <p key={key}>
                      <b>{key}:</b> {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                    </p>
                  ))}
                </article>
              );
            })}
          </>
        )}
      </div>
    </aside>
  );
}

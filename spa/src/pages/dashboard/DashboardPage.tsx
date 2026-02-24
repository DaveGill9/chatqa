import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import useEmblaCarousel from 'embla-carousel-react';
import usePagedRequest from '../../hooks/usePagedRequest';
import useFetchRequest from '../../hooks/useFetchRequest';
import Feedback from '../../components/feedback/Feedback';
import Icon from '../../components/icon/Icon';
import Page from '../../components/layout/Page';
import AnimatedDetailLayout from '../../components/layout/AnimatedDetailLayout';
import Modal from '../../components/popover/Modal';
import Input from '../../components/input/Input';
import Button from '../../components/button/Button';
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

type TestRow = {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  score?: number;
  reasoning?: string;
  [key: string]: unknown;
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
  const setIdFromUrl = searchParams.get('setId');

  const [keywords, setKeywords] = useState('');
  const [uploading, setUploading] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedResultSetId, setSelectedResultSetId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
    setSelectedResultSetId(resultSetId);
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
                        <strong>{stripFileExtension(testSet.name)}</strong>
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

      <ResultsModal
        resultSetId={selectedResultSetId}
        resultSets={resultSetsData ?? []}
        onClose={() => setSelectedResultSetId(null)}
      />
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
            {(data.cases ?? []).map((testCase) => (
              <article className={styles.caseCard} key={testCase._id}>
                <h3>{testCase.id}</h3>
                <p>
                  <b>Input:</b> {testCase.input}
                </p>
                <p>
                  <b>Expected:</b> {testCase.expected}
                </p>
              </article>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

function ResultsModal({
  resultSetId,
  resultSets,
  onClose,
}: {
  resultSetId: string | null;
  resultSets: ResultSet[];
  onClose: () => void;
}) {
  const selectedSet = useMemo(
    () => (resultSetId ? resultSets.find((rs) => rs._id === resultSetId) ?? null : null),
    [resultSetId, resultSets]
  );
  const [rows, setRows] = useState<TestRow[] | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    if (!resultSetId) {
      setRows(null);
      setModalVisible(false);
      return;
    }
    let cancelled = false;
    const fetchRows = async () => {
      try {
        const response = await apiClient.get(`/tests/results/sets/${resultSetId}`);
        const resData = response.data as { cases?: Array<Record<string, unknown>> };
        const cases = resData.cases ?? [];
        const mapped: TestRow[] = cases.map((c) => ({
          id: String(c.id ?? ''),
          input: String(c.input ?? ''),
          expected: String(c.expected ?? ''),
          actual: String(c.actual ?? ''),
          score: typeof c.score === 'number' ? c.score : 0,
          reasoning: String(c.reasoning ?? ''),
        }));
        if (!cancelled) {
          setRows(mapped);
          setModalVisible(true);
        }
      } catch (error) {
        if (!cancelled) toast.error(error);
      }
    };
    void fetchRows();
    return () => {
      cancelled = true;
    };
  }, [resultSetId]);

  const downloadResultSet = async (id: string, formatType: 'csv' | 'xlsx') => {
    try {
      const response = await apiClient.get(`/tests/results/sets/${id}/download`, {
        params: { format: formatType },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: formatType === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `result-set-${id}.${formatType}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Modal visible={modalVisible && !!rows} className={styles.previewDialog} onClose={onClose}>
      <ResultSetPreview
        resultSet={selectedSet}
        rows={rows ?? []}
        onDownload={(id, formatType) => void downloadResultSet(id, formatType)}
      />
    </Modal>
  );
}

interface ResultSetPreviewProps {
  resultSet: ResultSet | null;
  rows: TestRow[];
  onDownload: (resultSetId: string, formatType: 'csv' | 'xlsx') => void;
}

function ResultSetPreview({ resultSet, rows, onDownload }: ResultSetPreviewProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps' });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    onSelect();
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  useEffect(() => {
    if (emblaApi && rows.length > 0) {
      emblaApi.scrollTo(0);
      setSelectedIndex(0);
    }
  }, [resultSet?._id, emblaApi, rows]);

  return (
    <aside className={styles.preview}>
      <div className={styles.previewHeader}>
        <strong>{stripFileExtension(resultSet?.name ?? resultSet?.filename ?? '')}</strong>
        <div className={styles.previewHeaderActions}>
          <Button type="button" className={styles.downloadBtn} onClick={() => resultSet && onDownload(resultSet._id, 'xlsx')}>
            Download XLSX
          </Button>
          <Button type="button" variant="border" className={styles.downloadBtn} onClick={() => resultSet && onDownload(resultSet._id, 'csv')}>
            Download CSV
          </Button>
        </div>
      </div>
      <div className={styles.previewContent}>
        {!resultSet && <Feedback type="empty">Select a result to preview</Feedback>}
        {resultSet && (
          <div className={styles.previewMeta}>
            <div>
              <span className={styles.muted}>Test set</span>
              <div className={styles.metaValue}>{stripFileExtension(resultSet.testSetFilename || '') || '—'}</div>
            </div>
            <div>
              <span className={styles.muted}>Added</span>
              <div className={styles.metaValue}>{format(new Date(resultSet.createdAt), 'h:mma d MMM yyyy')}</div>
            </div>
          </div>
        )}
        {resultSet && rows.length === 0 && <Feedback type="empty">No rows found</Feedback>}
        {resultSet && rows.length > 0 && (
          <div className={styles.carouselWrap}>
            <div className={styles.embla} ref={emblaRef}>
              <div className={styles.emblaContainer}>
                {rows.map((row, index) => (
                  <div key={`${row.id}-${index}`} className={styles.emblaSlide}>
                    <div className={styles.caseCard}>
                      <div className={styles.caseCardHeader}>
                        <span className={styles.caseId}>Case {row.id}</span>
                        <span className={styles.caseScore}>{typeof row.score === 'number' ? row.score.toFixed(2) : '—'}</span>
                      </div>
                      <div className={styles.caseCardSection}>
                        <span className={styles.caseLabel}>Input</span>
                        <div className={styles.caseValue}>{row.input || '—'}</div>
                      </div>
                      <div className={styles.caseCardSection}>
                        <span className={styles.caseLabel}>Expected</span>
                        <div className={[styles.caseValue, styles.caseValueMarkdown].join(' ')}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{row.expected || '—'}</ReactMarkdown>
                        </div>
                      </div>
                      <div className={styles.caseCardSection}>
                        <span className={styles.caseLabel}>Actual</span>
                        <div className={[styles.caseValue, styles.caseValueMarkdown].join(' ')}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{row.actual || '—'}</ReactMarkdown>
                        </div>
                      </div>
                      <div className={styles.caseCardSection}>
                        <span className={styles.caseLabel}>Reasoning</span>
                        <div className={[styles.caseValue, styles.caseValueMarkdown].join(' ')}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{row.reasoning || '—'}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.carouselNav}>
              <button type="button" className={styles.carouselBtn} onClick={scrollPrev} disabled={selectedIndex === 0} aria-label="Previous">
                ‹
              </button>
              <div className={styles.carouselDots} role="tablist">
                {rows.map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={index === selectedIndex}
                    className={[styles.carouselDot, index === selectedIndex ? styles.carouselDotActive : ''].join(' ')}
                    onClick={() => scrollTo(index)}
                  />
                ))}
              </div>
              <button type="button" className={styles.carouselBtn} onClick={scrollNext} disabled={selectedIndex === rows.length - 1} aria-label="Next">
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

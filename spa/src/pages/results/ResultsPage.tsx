import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import usePagedRequest from '../../hooks/usePagedRequest';
import Feedback from '../../components/feedback/Feedback';
import Icon from '../../components/icon/Icon';
import Page from '../../components/layout/Page';
import AnimatedDetailLayout from '../../components/layout/AnimatedDetailLayout';
import IconButton from '../../components/icon/IconButton';
import Input from '../../components/input/Input';
import Button from '../../components/button/Button';
import { addSearchParams } from '../../utils';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import styles from './ResultsPage.module.scss';

type ResultRun = {
  _id: string;
  testSetId: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  rowCount?: number;
  resultSizeBytesXlsx?: number | null;
  testSetName?: string;
  testSetFilename?: string;
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

type SortKey = 'createdAt' | 'name' | 'testSet' | 'fileType' | 'sizeBytes' | 'rowCount';
type SortDirection = 'asc' | 'desc';

const getResultFilename = (runId: string) => `test-run-${runId}-results.xlsx`;
const getFileType = () => 'XLSX';

const formatBytes = (bytes?: number | null) => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  const digits = exponent === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[exponent]}`;
};

export default function ResultsPage() {
  const [searchParams] = useSearchParams();
  const setIdFilter = searchParams.get('setId') ?? '';

  const [keywords, setKeywords] = useState('');
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const baseUrl = '/tests/runs';
  const buildUrl = useCallback((nextKeywords?: string) => {
    const params: Record<string, string> = {};
    if (setIdFilter) params.setId = setIdFilter;
    const trimmed = (nextKeywords ?? keywords).trim();
    if (trimmed) params.keywords = trimmed;
    return Object.keys(params).length ? addSearchParams(baseUrl, params) : baseUrl;
  }, [keywords, setIdFilter]);

  const [url, setUrl] = useState(() => buildUrl(''));
  const { data, loading, reset } = usePagedRequest<ResultRun>(url, { limit: 200 });

  useEffect(() => {
    setUrl(buildUrl());
  }, [buildUrl]);

  const handleSearch = () => {
    setUrl(buildUrl());
  };

  const sortedData = useMemo(() => {
    const list = (data ?? []).slice();
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
          const av = getResultFilename(a._id);
          const bv = getResultFilename(b._id);
          return direction * compareText(av, bv);
        }
        case 'testSet': {
          const av = a.testSetFilename ?? '';
          const bv = b.testSetFilename ?? '';
          return direction * (compareText(av, bv) || compareText(getResultFilename(a._id), getResultFilename(b._id)));
        }
        case 'fileType': {
          return direction * compareText(getFileType(), getFileType());
        }
        case 'sizeBytes': {
          const av = typeof a.resultSizeBytesXlsx === 'number' ? a.resultSizeBytesXlsx : 0;
          const bv = typeof b.resultSizeBytesXlsx === 'number' ? b.resultSizeBytesXlsx : 0;
          return direction * (compareNumber(av, bv) || compareText(getResultFilename(a._id), getResultFilename(b._id)));
        }
        case 'rowCount': {
          const av = a.rowCount ?? 0;
          const bv = b.rowCount ?? 0;
          return direction * (compareNumber(av, bv) || compareText(getResultFilename(a._id), getResultFilename(b._id)));
        }
        default:
          return 0;
      }
    });

    return list;
  }, [data, sortDirection, sortKey]);

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

  const selectedRun = useMemo(() => {
    if (!selectedRunId) return null;
    return (data ?? []).find((run) => run._id === selectedRunId) ?? null;
  }, [data, selectedRunId]);

  const downloadResults = async (testRunId: string, formatType: 'csv' | 'xlsx') => {
    try {
      const response = await apiClient.get(`/tests/runs/${testRunId}/download`, {
        params: { format: formatType },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type:
          formatType === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `test-run-${testRunId}-results.${formatType}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error);
    }
  };

  const resultsHref = setIdFilter ? `/results?setId=${setIdFilter}` : '/results';

  return (
    <Page>
      <Page.Header
        title="Documents"
        subtitle="View and download generated results."
        bottom={(
          <nav className={styles.pageTabs} aria-label="Tests navigation">
            <NavLink
              to="/tests"
              end
              className={({ isActive }) => [styles.pageTab, isActive ? styles.pageTabActive : ''].join(' ')}
            >
              Tests
            </NavLink>
            <NavLink
              to={resultsHref}
              className={({ isActive }) => [styles.pageTab, isActive ? styles.pageTabActive : ''].join(' ')}
            >
              Results
            </NavLink>
          </nav>
        )}
      >
        {/* actions intentionally kept minimal */}
      </Page.Header>

      <Page.Content>
        <div className={styles.layout}>
          <div className={styles.list}>
            {loading && <Feedback type="loading" />}
            {!loading && data?.length === 0 && <Feedback type="empty">No results found</Feedback>}

            <div className={styles.controlsBar}>
              <div className={styles.controlsLeft}>
                <div className={styles.searchWrap}>
                  <Icon name="search" />
                  <Input
                    type="search"
                    placeholder="Search results"
                    value={keywords}
                    onTextChange={setKeywords}
                    onEnter={handleSearch}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              <Button type="button" className={styles.refreshButton} onClick={() => reset()}>
                Refresh
              </Button>
            </div>

            <div className={styles.listCard}>
              {!!sortedData.length && (
                <div className={styles.listHeader} role="row">
                  <button
                    type="button"
                    className={styles.headerButton}
                    onClick={() => toggleSort('name')}
                    aria-label="Sort by title"
                  >
                    Title {sortIndicator('name')}
                  </button>
                  <button
                    type="button"
                    className={[styles.headerButton, styles.testSetCell].join(' ')}
                    onClick={() => toggleSort('testSet')}
                    aria-label="Sort by test set"
                  >
                    Test set {sortIndicator('testSet')}
                  </button>
                  <button
                    type="button"
                    className={[styles.headerButton, styles.fileTypeCell].join(' ')}
                    onClick={() => toggleSort('fileType')}
                    aria-label="Sort by file type"
                  >
                    File type {sortIndicator('fileType')}
                  </button>
                  <button
                    type="button"
                    className={[styles.headerButton, styles.sizeCell].join(' ')}
                    onClick={() => toggleSort('sizeBytes')}
                    aria-label="Sort by file size"
                  >
                    Size {sortIndicator('sizeBytes')}
                  </button>
                  <button
                    type="button"
                    className={[styles.headerButton, styles.countCell].join(' ')}
                    onClick={() => toggleSort('rowCount')}
                    aria-label="Sort by tests number"
                  >
                    Tests number {sortIndicator('rowCount')}
                  </button>
                  <button
                    type="button"
                    className={[styles.headerButton, styles.dateCell].join(' ')}
                    onClick={() => toggleSort('createdAt')}
                    aria-label="Sort by added date"
                  >
                    Added {sortIndicator('createdAt')}
                  </button>
                </div>
              )}

              {sortedData.map((run) => (
                <Button
                  type="block"
                  key={run._id}
                  className={[styles.resultFile, selectedRunId === run._id ? styles.active : ''].join(' ')}
                  onClick={() => {
                    setSelectedRunId(run._id);
                    setPreviewVisible(true);
                  }}
                >
                  <div className={styles.titleCell}>
                    <strong>{getResultFilename(run._id)}</strong>
                    <span className={styles.muted}>
                      {run.status}
                      {run.testSetName ? ` • ${run.testSetName}` : ''}
                    </span>
                  </div>
                  <div className={styles.testSetCell}>{run.testSetFilename ?? '—'}</div>
                  <div className={styles.fileTypeCell}>{getFileType()}</div>
                  <div className={styles.sizeCell}>{formatBytes(run.resultSizeBytesXlsx)}</div>
                  <div className={styles.countCell}>{run.rowCount ?? 0}</div>
                  <div className={styles.dateCell}>{format(new Date(run.createdAt), 'h:mma d MMM yyyy')}</div>
                </Button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {previewVisible && selectedRunId && (
              <AnimatedDetailLayout
                width={860}
                onClose={() => {
                  setPreviewVisible(false);
                  setSelectedRunId(null);
                }}
              >
                <ResultRunPreview
                  run={selectedRun}
                  onClose={() => {
                    setPreviewVisible(false);
                    setSelectedRunId(null);
                  }}
                  onDownload={(runId, formatType) => void downloadResults(runId, formatType)}
                />
              </AnimatedDetailLayout>
            )}
          </AnimatePresence>
        </div>
      </Page.Content>
    </Page>
  );
}

interface ResultRunPreviewProps {
  run: ResultRun | null;
  onClose: () => void;
  onDownload: (runId: string, formatType: 'csv' | 'xlsx') => void;
}

function ResultRunPreview({ run, onClose, onDownload }: ResultRunPreviewProps) {
  const [rows, setRows] = useState<TestRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    const runId = run?._id;
    if (!runId) {
      setRows([]);
      return;
    }

    const fetchRows = async () => {
      setLoadingRows(true);
      try {
        const response = await apiClient.get(`/tests/runs/${runId}/results`);
        const data = response.data as { rows: TestRow[] };
        setRows(data.rows ?? []);
      } catch (error) {
        toast.error(error);
      } finally {
        setLoadingRows(false);
      }
    };

    void fetchRows();
  }, [run?._id]);

  return (
    <aside className={styles.preview}>
      <div className={styles.previewHeader}>
        <strong>{run?._id ? getResultFilename(run._id) : ''}</strong>
        <IconButton icon="right_panel_close" onClick={onClose} />
      </div>

      <div className={styles.previewContent}>
        {!run && <Feedback type="empty">Select a result file to preview</Feedback>}
        {run && (
          <div className={styles.previewMeta}>
            <div>
              <span className={styles.muted}>Test set</span>
              <div className={styles.metaValue}>{run.testSetFilename || '—'}</div>
            </div>
            <div>
              <span className={styles.muted}>Status</span>
              <div className={styles.metaValue}>{run.status}</div>
            </div>
            <div>
              <span className={styles.muted}>Added</span>
              <div className={styles.metaValue}>{format(new Date(run.createdAt), 'h:mma d MMM yyyy')}</div>
            </div>
          </div>
        )}

        {run && (
          <div className={styles.previewActions}>
            <Button type="button" onClick={() => onDownload(run._id, 'xlsx')}>
              Download XLSX
            </Button>
            <Button type="button" variant="border" onClick={() => onDownload(run._id, 'csv')}>
              Download CSV
            </Button>
          </div>
        )}

        {loadingRows && run && <Feedback type="loading" />}
        {!loadingRows && run && rows.length === 0 && <Feedback type="empty">No rows found for this run</Feedback>}

        {run && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>id</th>
                  <th>input</th>
                  <th>expected</th>
                  <th>actual</th>
                  <th>score</th>
                  <th>reasoning</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td>{String(row.id ?? '')}</td>
                    <td>{String(row.input ?? '')}</td>
                    <td>{String(row.expected ?? '')}</td>
                    <td>{String(row.actual ?? '')}</td>
                    <td>{typeof row.score === 'number' ? row.score.toFixed(2) : ''}</td>
                    <td>{String(row.reasoning ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </aside>
  );
}

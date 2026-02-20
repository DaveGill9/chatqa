import { useEffect, useMemo, useState } from 'react';
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

type SortKey = 'createdAt' | 'name' | 'testSet' | 'fileType' | 'sizeBytes' | 'testCaseCount';
type SortDirection = 'asc' | 'desc';
type FileFilter = 'all' | 'csv' | 'xlsx';

const getFileType = (filename: string) => {
  const ext = (filename.split('.').pop() || '').trim().toLowerCase();
  if (!ext) return '—';
  return ext.toUpperCase();
};

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
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const baseUrl = '/tests/results/sets';
  const [url, setUrl] = useState(baseUrl);
  const { data, loading, reset } = usePagedRequest<ResultSet>(url, { limit: 200 });

  useEffect(() => {
    if (setIdFilter) {
      setUrl(addSearchParams(baseUrl, { setId: setIdFilter }));
      return;
    }
    setUrl(baseUrl);
  }, [setIdFilter]);

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (setIdFilter) params.setId = setIdFilter;
    if (keywords.trim()) params.keywords = keywords.trim();
    setUrl(Object.keys(params).length ? addSearchParams(baseUrl, params) : baseUrl);
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
          const base = compareText(a.name, b.name);
          return direction * (base || compareText(a.filename, b.filename));
        }
        case 'testSet': {
          const av = a.testSetFilename ?? '';
          const bv = b.testSetFilename ?? '';
          return direction * (compareText(av, bv) || compareText(a.name, b.name));
        }
        case 'fileType': {
          const av = getFileType(a.filename);
          const bv = getFileType(b.filename);
          const base = compareText(av, bv);
          return direction * (base || compareText(a.name, b.name));
        }
        case 'sizeBytes': {
          const av = a.sizeBytes ?? 0;
          const bv = b.sizeBytes ?? 0;
          return direction * (compareNumber(av, bv) || compareText(a.name, b.name));
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

  const selectedSet = useMemo(() => {
    if (!selectedSetId) return null;
    return (data ?? []).find((set) => set._id === selectedSetId) ?? null;
  }, [data, selectedSetId]);

  const downloadResultSet = async (resultSetId: string, formatType: 'csv' | 'xlsx') => {
    try {
      const response = await apiClient.get(`/tests/results/sets/${resultSetId}/download`, {
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
      a.download = `result-set-${resultSetId}.${formatType}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error);
    }
  };

  const resultsHref = setIdFilter ? `/results?setId=${setIdFilter}` : '/results';

  const visibleData = useMemo(() => {
    const list = sortedData;
    if (fileFilter === 'all') return list;
    const wanted = fileFilter.toUpperCase();
    return list.filter((set) => getFileType(set.filename) === wanted);
  }, [fileFilter, sortedData]);

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
                <div className={styles.segmented} role="group" aria-label="File type filter">
                  <button
                    type="button"
                    className={[styles.segment, fileFilter === 'all' ? styles.segmentActive : ''].join(' ')}
                    onClick={() => setFileFilter('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={[styles.segment, fileFilter === 'csv' ? styles.segmentActive : ''].join(' ')}
                    onClick={() => setFileFilter('csv')}
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    className={[styles.segment, fileFilter === 'xlsx' ? styles.segmentActive : ''].join(' ')}
                    onClick={() => setFileFilter('xlsx')}
                  >
                    XLSX
                  </button>
                </div>

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

              <Button
                type="button"
                className={styles.refreshButton}
                onClick={() => reset()}
              >
                Refresh
              </Button>
            </div>

            <div className={styles.listCard}>
              {!!visibleData.length && (
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
                    onClick={() => toggleSort('testCaseCount')}
                    aria-label="Sort by tests number"
                  >
                    Tests number {sortIndicator('testCaseCount')}
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

              {visibleData.map((resultSet) => (
                <Button
                  type="block"
                  key={resultSet._id}
                  className={[styles.resultFile, selectedSetId === resultSet._id ? styles.active : ''].join(' ')}
                  onClick={() => {
                    setSelectedSetId(resultSet._id);
                    setPreviewVisible(true);
                  }}
                >
                  <div className={styles.titleCell}>
                    <strong>{resultSet.name}</strong>
                    <span className={styles.muted}>{resultSet.filename}</span>
                  </div>
                  <div className={styles.testSetCell}>{resultSet.testSetFilename ?? '—'}</div>
                  <div className={styles.fileTypeCell}>{getFileType(resultSet.filename)}</div>
                  <div className={styles.sizeCell}>{formatBytes(resultSet.sizeBytes)}</div>
                  <div className={styles.countCell}>{resultSet.testCaseCount ?? 0}</div>
                  <div className={styles.dateCell}>{format(new Date(resultSet.createdAt), 'h:mma d MMM yyyy')}</div>
                </Button>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {previewVisible && selectedSetId && (
              <AnimatedDetailLayout
                width={860}
                onClose={() => {
                  setPreviewVisible(false);
                  setSelectedSetId(null);
                }}
              >
                <ResultSetPreview
                  resultSet={selectedSet}
                  onClose={() => {
                    setPreviewVisible(false);
                    setSelectedSetId(null);
                  }}
                  onDownload={(resultSetId, formatType) => void downloadResultSet(resultSetId, formatType)}
                />
              </AnimatedDetailLayout>
            )}
          </AnimatePresence>
        </div>
      </Page.Content>
    </Page>
  );
}

interface ResultSetPreviewProps {
  resultSet: ResultSet | null;
  onClose: () => void;
  onDownload: (resultSetId: string, formatType: 'csv' | 'xlsx') => void;
}

type ResultCase = {
  _id: string;
  id: string;
  input: string;
  expected: string;
  actual: string;
  score: number;
  reasoning: string;
};

function ResultSetPreview({ resultSet, onClose, onDownload }: ResultSetPreviewProps) {
  const [rows, setRows] = useState<TestRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  useEffect(() => {
    const resultSetId = resultSet?._id;
    if (!resultSetId) {
      setRows([]);
      return;
    }

    const fetchRows = async () => {
      setLoadingRows(true);
      try {
        const response = await apiClient.get(`/tests/results/sets/${resultSetId}`);
        const data = response.data as { cases?: ResultCase[] };
        const cases = data.cases ?? [];
        setRows(
          cases.map((c) => ({
            id: String(c.id ?? ''),
            input: String(c.input ?? ''),
            expected: String(c.expected ?? ''),
            actual: String(c.actual ?? ''),
            score: typeof c.score === 'number' ? c.score : 0,
            reasoning: String(c.reasoning ?? ''),
          })),
        );
      } catch (error) {
        toast.error(error);
      } finally {
        setLoadingRows(false);
      }
    };

    void fetchRows();
  }, [resultSet?._id]);

  return (
    <aside className={styles.preview}>
      <div className={styles.previewHeader}>
        <strong>{resultSet?.filename || ''}</strong>
        <IconButton icon="right_panel_close" onClick={onClose} />
      </div>

      <div className={styles.previewContent}>
        {!resultSet && <Feedback type="empty">Select a result file to preview</Feedback>}
        {resultSet && (
          <div className={styles.previewMeta}>
            <div>
              <span className={styles.muted}>Test set</span>
              <div className={styles.metaValue}>{resultSet.testSetFilename || '—'}</div>
            </div>
            <div>
              <span className={styles.muted}>Format</span>
              <div className={styles.metaValue}>{getFileType(resultSet.filename)}</div>
            </div>
            <div>
              <span className={styles.muted}>Added</span>
              <div className={styles.metaValue}>{format(new Date(resultSet.createdAt), 'h:mma d MMM yyyy')}</div>
            </div>
          </div>
        )}

        {resultSet && (
          <div className={styles.previewActions}>
            <Button type="button" onClick={() => onDownload(resultSet._id, 'xlsx')}>
              Download XLSX
            </Button>
            <Button type="button" variant="border" onClick={() => onDownload(resultSet._id, 'csv')}>
              Download CSV
            </Button>
          </div>
        )}

        {loadingRows && resultSet && <Feedback type="loading" />}
        {!loadingRows && resultSet && rows.length === 0 && <Feedback type="empty">No rows found for this set</Feedback>}

        {resultSet && rows.length > 0 && (
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

import { useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import usePagedRequest from '../../hooks/usePagedRequest';
import useFetchRequest from '../../hooks/useFetchRequest';
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
import styles from './TestsPage.module.scss';

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

type SortKey = 'createdAt' | 'name' | 'fileType' | 'sizeBytes' | 'testCaseCount';
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

export default function TestsPage() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [fileFilter, setFileFilter] = useState<FileFilter>('all');
  const [uploading, setUploading] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const baseUrl = '/tests/sets';
  const [url, setUrl] = useState(baseUrl);
  const { data, setData, loading } = usePagedRequest<TestSet>(url, { limit: 200 });

  const handleSearch = () => {
    if (!keywords.trim()) {
      setUrl(baseUrl);
      return;
    }
    setUrl(addSearchParams(baseUrl, { keywords: keywords.trim() }));
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

      setData((prev) => {
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

  const visibleData = useMemo(() => {
    if (fileFilter === 'all') return sortedData;
    const wanted = fileFilter.toUpperCase();
    return sortedData.filter((set) => getFileType(set.filename) === wanted);
  }, [fileFilter, sortedData]);

  const resultsHref = selectedSetId ? `/results?setId=${selectedSetId}` : '/results';

  return (
    <Page>
      <Page.Header
        title="Documents"
        subtitle="View and manage uploaded CSV/XLSX test sets."
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
            {uploading && <Feedback type="loading">Uploading test file...</Feedback>}
            {loading && <Feedback type="loading" />}
            {!loading && data?.length === 0 && <Feedback type="empty">No test sets found</Feedback>}

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
                    placeholder="Search documents"
                    value={keywords}
                    onTextChange={setKeywords}
                    onEnter={handleSearch}
                    className={styles.searchInput}
                  />
                </div>
              </div>

              <Button type="button" className={styles.uploadButton} onClick={selectFiles}>
                <Icon name="upload" /> Upload document
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

              {visibleData.map((testSet) => (
                <Button
                  type="block"
                  key={testSet._id}
                  className={[styles.testSet, selectedSetId === testSet._id ? styles.active : ''].join(' ')}
                  onClick={() => {
                    setSelectedSetId(testSet._id);
                    setPreviewVisible(true);
                  }}
                >
                  <div className={styles.titleCell}>
                    <strong>{testSet.name}</strong>
                  </div>
                  <div className={styles.fileTypeCell}>{getFileType(testSet.filename)}</div>
                  <div className={styles.sizeCell}>{formatBytes(testSet.sizeBytes)}</div>
                  <div className={styles.countCell}>{testSet.testCaseCount ?? 0}</div>
                  <div className={styles.dateCell}>{format(new Date(testSet.createdAt), 'h:mma d MMM yyyy')}</div>
                </Button>
              ))}
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
                  onOpenResults={(testSetId) => navigate(`/results?setId=${testSetId}`)}
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
  onOpenResults: (testSetId: string) => void;
}

function TestSetPreview({ testSetId, onClose, onOpenResults }: TestSetPreviewProps) {
  const { data, loading } = useFetchRequest<TestSetDetail>(testSetId ? `/tests/sets/${testSetId}` : '');
  const previewCases = data?.cases ?? [];
  const [running, setRunning] = useState(false);

  const runTestSet = async () => {
    if (!testSetId || running) return;

    setRunning(true);
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
      onOpenResults(testSetId);
    } catch (error) {
      toast.error(error);
    } finally {
      setRunning(false);
    }
  };

  return (
    <aside className={styles.preview}>
        <div className={styles.previewHeader}>
          <strong>{data?.filename || ''}</strong>
          <IconButton icon="right_panel_close" onClick={onClose} />
        </div>

        <div className={styles.previewContent}>
          {!testSetId && <Feedback type="empty">Select a test file to preview</Feedback>}
          {loading && testSetId && <Feedback type="loading" />}

          {!loading && data && (
            <>
              {previewCases.length === 0 && <Feedback type="empty">No test rows found</Feedback>}
              {previewCases.map((testCase) => (
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

              {testSetId && (
                <div className={styles.previewActions}>
                  <Button
                    type="button"
                    variant="accent"
                    working={running}
                    className={styles.runButton}
                    aria-disabled={running}
                    onClick={runTestSet}
                  >
                    Run
                  </Button>
                  <Button
                    type="button"
                    variant="border"
                    className={styles.openResultsButton}
                    aria-disabled={running}
                    onClick={() => {
                      if (running) return;
                      onOpenResults(testSetId);
                    }}
                  >
                    View Results
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
  );
}

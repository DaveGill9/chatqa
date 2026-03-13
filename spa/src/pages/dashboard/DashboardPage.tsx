import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import usePagedRequest from '../../hooks/usePagedRequest';
import Page from '../../components/layout/Page';
import AnimatedDetailLayout from '../../components/layout/AnimatedDetailLayout';
import Alert from '../../components/popover/Alert';
import { addSearchParams } from '../../utils';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import { useJobs } from '../../context/JobsContext';
import { stripFileExtension } from '../../utils';
import type { SortKey, SortDirection, TestSet, ResultSet } from './types';
import { ConvertFormatDialog, TestSetList, TestSetPreview } from './components';
import styles from './DashboardPage.module.scss';

export default function DashboardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setIdFromUrl = searchParams.get('setId');

  const [uploading, setUploading] = useState(false);
  const [convertDialogVisible, setConvertDialogVisible] = useState(false);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [deleteConfirmSetId, setDeleteConfirmSetId] = useState<string | null>(null);
  const [openMenuSetId, setOpenMenuSetId] = useState<string | null>(null);

  const [appliedKeywords, setAppliedKeywords] = useState('');
  const testSetsUrl = addSearchParams('/tests/sets', appliedKeywords ? { keywords: appliedKeywords } : {});
  const { data: testSetsData, setData: setTestSetsData, loading: testSetsLoading, reset: resetTestSets } =
    usePagedRequest<TestSet>(testSetsUrl, { limit: 200 });

  const { data: resultSetsData, loading: resultSetsLoading, reset: resetResultSets } =
    usePagedRequest<ResultSet>('/results/sets', { limit: 500 });
  const { jobs } = useJobs();
  const processedRunIds = useRef<Set<string>>(new Set());
  const processedConvertIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (setIdFromUrl) {
      setExpandedSetId(setIdFromUrl);
    }
  }, [setIdFromUrl]);

  useEffect(() => {
    const completedRuns = jobs.filter(
      (j) => j.type === 'run_test_set' && (j.status === 'completed' || j.status === 'failed'),
    );
    const toProcess = completedRuns.filter((j) => !processedRunIds.current.has(j.id));
    if (toProcess.length === 0) return;
    toProcess.forEach((j) => processedRunIds.current.add(j.id));
    const timeout = setTimeout(() => {
      resetResultSets();
      resetTestSets();
    }, 500);
    return () => clearTimeout(timeout);
  }, [jobs, resetResultSets, resetTestSets]);

  useEffect(() => {
    const completedConverts = jobs.filter(
      (j) => j.type === 'convert_format' && (j.status === 'completed' || j.status === 'failed'),
    );
    const toProcess = completedConverts.filter((j) => !processedConvertIds.current.has(j.id));
    if (toProcess.length === 0) return;
    toProcess.forEach((j) => processedConvertIds.current.add(j.id));
    const timeout = setTimeout(() => resetTestSets(), 500);
    return () => clearTimeout(timeout);
  }, [jobs, resetTestSets]);

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
        case 'updatedAt': {
          const av = new Date(a.updatedAt || a.createdAt).getTime();
          const bv = new Date(b.updatedAt || b.createdAt).getTime();
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
    setSortDirection(nextKey === 'updatedAt' ? 'desc' : 'asc');
  };

  const handlePreview = (testSetId: string) => {
    setSelectedSetId(testSetId);
    setPreviewVisible(true);
  };

  const handleRun = async (testSetId: string) => {
    try {
      const response = await apiClient.post(`/tests/sets/${testSetId}/run`);
      const result = response.data as { jobId: string; resultSetId: string; testSetId: string; status: string; total: number };
      const now = new Date().toISOString();
      setTestSetsData((prev) => {
        if (!prev) return prev;
        return prev.map((s) => (s._id === testSetId ? { ...s, updatedAt: now } : s));
      });
      toast.success(`Run started (${result.total} cases). Watch the Jobs panel for progress.`);
      setExpandedSetId(testSetId);
    } catch (error) {
      toast.error(error);
    }
  };

  const handleViewResult = (resultSetId: string) => {
    navigate(`/results/${resultSetId}`);
  };

  const handleDelete = async (testSetId: string) => {
    try {
      await apiClient.delete(`/tests/sets/${testSetId}`);
      setTestSetsData((prev) => (prev ? prev.filter((s) => s._id !== testSetId) : []));
      setDeleteConfirmSetId(null);
      if (selectedSetId === testSetId) {
        setPreviewVisible(false);
        setSelectedSetId(null);
      }
      if (expandedSetId === testSetId) setExpandedSetId(null);
      resetResultSets();
      toast.success('Test set deleted');
    } catch (error) {
      toast.error(error);
    }
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
      const now = new Date().toISOString();
      setTestSetsData((prev) => {
        if (!prev) return prev;
        return prev.map((s) => (s._id === testSetId ? { ...s, name: updated.name, updatedAt: now } : s));
      });
      toast.success('Test set renamed');
    } catch (error) {
      toast.error(error);
    } finally {
      setEditingSetId(null);
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

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const response = await apiClient.post('/tests/upload', formData);
      const now = new Date().toISOString();
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
          createdAt: now,
          updatedAt: now,
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

  return (
    <Page>
      <Page.Header
        title="Dashboard"
        subtitle="Upload test sets, run tests, and view results."
      />

      <Page.Content>
        <div className={styles.layout}>
          <TestSetList
            sortedTestSets={sortedTestSets}
            runsByTestSet={runsByTestSet}
            sortKey={sortKey}
            sortDirection={sortDirection}
            expandedSetId={expandedSetId}
            editingSetId={editingSetId}
            openMenuSetId={openMenuSetId}
            keywords={appliedKeywords}
            uploading={uploading}
            loading={testSetsLoading || resultSetsLoading}
            onSearch={(keywords) => setAppliedKeywords(keywords)}
            onConvert={() => setConvertDialogVisible(true)}
            onUpload={selectFiles}
            onToggleSort={toggleSort}
            onToggleExpand={(id) => setExpandedSetId((prev) => (prev === id ? null : id))}
            onEdit={setEditingSetId}
            onCancelEdit={() => setEditingSetId(null)}
            onPreview={handlePreview}
            onRun={handleRun}
            onRequestDelete={setDeleteConfirmSetId}
            onRename={handleRename}
            onViewResult={handleViewResult}
            onMenuToggle={setOpenMenuSetId}
          />

          <ConvertFormatDialog visible={convertDialogVisible} onClose={() => setConvertDialogVisible(false)} />

          <Alert
            title="Delete test set"
            visible={!!deleteConfirmSetId}
            setVisible={(v) => !v && setDeleteConfirmSetId(null)}
            confirmText="Delete"
            onConfirm={deleteConfirmSetId ? () => handleDelete(deleteConfirmSetId) : undefined}
          >
            <p>
              Are you sure you want to delete{' '}
              <strong>
                {stripFileExtension(sortedTestSets.find((s) => s._id === deleteConfirmSetId)?.name ?? 'this test set')}
              </strong>
              ? This will also remove all test cases, runs, and results.
            </p>
          </Alert>

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

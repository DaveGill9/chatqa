import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import Page from '../../components/layout/Page';
import Button from '../../components/button/Button';
import Feedback from '../../components/feedback/Feedback';
import IconButton from '../../components/icon/IconButton';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import { stripFileExtension } from '../../utils';
import type { Evaluation, ResultSetMeta, TestRow } from './types';
import { EvaluationModal, ResultCarousel, ResultDownloadMenu } from './components';
import styles from './ResultDetailPage.module.scss';

export default function ResultDetailPage() {
  const { resultSetId } = useParams<{ resultSetId: string }>();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<ResultSetMeta | null>(null);
  const [rows, setRows] = useState<TestRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [evaluateModalOpen, setEvaluateModalOpen] = useState(false);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluationLoading, setEvaluationLoading] = useState(false);

  useEffect(() => {
    if (!resultSetId) {
      setMeta(null);
      setRows(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get(`/results/sets/${resultSetId}`);
        const resData = response.data as {
          _id?: string;
          name?: string;
          filename?: string;
          testSetName?: string | null;
          testSetFilename?: string | null;
          createdAt?: string;
          cases?: Array<Record<string, unknown>>;
        };
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
          setMeta({
            _id: resData._id ?? resultSetId,
            name: resData.name ?? '',
            filename: resData.filename ?? '',
            testSetName: resData.testSetName ?? null,
            testSetFilename: resData.testSetFilename ?? null,
            createdAt: resData.createdAt ?? new Date().toISOString(),
          });
          setRows(mapped);
        }
      } catch (error) {
        if (!cancelled) toast.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [resultSetId]);

  const fetchEvaluation = async (id: string) => {
    setEvaluationLoading(true);
    setEvaluation(null);
    try {
      const res = await apiClient.get(`/results/sets/${id}/evaluation`);
      const data = res.data as Evaluation | null;
      setEvaluation(data);
    } catch (error) {
      toast.error(error);
    } finally {
      setEvaluationLoading(false);
    }
  };

  const downloadResultSet = async (id: string, formatType: 'csv' | 'xlsx') => {
    try {
      const response = await apiClient.get(`/results/sets/${id}/download`, {
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
      a.download = `result-set-${id}.${formatType}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error);
    }
  };

  if (!resultSetId) {
    return (
      <Page>
        <Page.Header title="Result" />
        <Page.Content>
          <Feedback type="empty">No result set selected</Feedback>
        </Page.Content>
      </Page>
    );
  }

  return (
    <Page>
      <Page.Header
        data-no-print
        title="Results"
        subtitle={
          meta
            ? [
                stripFileExtension(meta.testSetFilename || meta.testSetName || ''),
                format(new Date(meta.createdAt), 'h:mma d MMM yyyy'),
              ]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
      >
        <IconButton icon="arrow_back" onClick={() => navigate('/')} aria-label="Back to dashboard" />
        {meta && (
          <div className={styles.headerActions}>
            <Button
              type="button"
              variant="border"
              className={styles.evaluateBtn}
              onClick={() => {
                setEvaluateModalOpen(true);
                void fetchEvaluation(meta._id);
              }}
            >
              Evaluate
            </Button>
            <ResultDownloadMenu
              resultSetId={meta._id}
              visible={downloadMenuOpen}
              onVisibleChange={setDownloadMenuOpen}
              onDownloadCsv={(id) => void downloadResultSet(id, 'csv')}
              onDownloadXlsx={(id) => void downloadResultSet(id, 'xlsx')}
            />
          </div>
        )}
      </Page.Header>

      <EvaluationModal
        visible={evaluateModalOpen}
        onClose={() => setEvaluateModalOpen(false)}
        evaluation={evaluation}
        loading={evaluationLoading}
      />

      <Page.Content>
        {loading && <Feedback type="loading" />}
        {!loading && meta && rows && rows.length === 0 && <Feedback type="empty">No rows found</Feedback>}
        {!loading && meta && rows && rows.length > 0 && <ResultCarousel rows={rows} />}
      </Page.Content>
    </Page>
  );
}

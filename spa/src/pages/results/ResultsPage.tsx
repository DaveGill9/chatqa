import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import Page from '../../components/layout/Page';
import Input from '../../components/input/Input';
import Button from '../../components/button/Button';
import Feedback from '../../components/feedback/Feedback';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import styles from './ResultsPage.module.scss';

type TestSet = {
  _id: string;
  name: string;
  filename: string;
  project?: string | null;
  createdAt: string;
};

type TestRun = {
  _id: string;
  testSetId: string;
  status: string;
  createdAt: string;
  completedAt?: string;
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

export default function ResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSetId = searchParams.get('setId') ?? '';

  const [sets, setSets] = useState<TestSet[]>([]);
  const [selectedSetId, setSelectedSetId] = useState(initialSetId);
  const [runs, setRuns] = useState<TestRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [rows, setRows] = useState<TestRow[]>([]);
  const [setFilter, setSetFilter] = useState('');

  const [running, setRunning] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [loadingSets, setLoadingSets] = useState(false);

  useEffect(() => {
    void fetchSets();
  }, []);

  useEffect(() => {
    if (selectedSetId) {
      setSearchParams({ setId: selectedSetId });
      void fetchRuns(selectedSetId);
    } else {
      setSearchParams({});
      setRuns([]);
      setSelectedRunId('');
      setRows([]);
    }
  }, [selectedSetId, setSearchParams]);

  useEffect(() => {
    if (selectedRunId) {
      void fetchRows(selectedRunId);
    } else {
      setRows([]);
    }
  }, [selectedRunId]);

  const filteredSets = useMemo(() => {
    const query = setFilter.trim().toLowerCase();
    if (!query) return sets;
    return sets.filter((set) =>
      `${set.name} ${set.filename} ${set.project ?? ''}`.toLowerCase().includes(query),
    );
  }, [sets, setFilter]);

  const fetchSets = async () => {
    setLoadingSets(true);
    try {
      const response = await apiClient.get('/tests/sets');
      const data = response.data as TestSet[];
      setSets(data);
      if (!selectedSetId && data.length > 0) {
        setSelectedSetId(data[0]._id);
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setLoadingSets(false);
    }
  };

  const fetchRuns = async (testSetId: string) => {
    try {
      const response = await apiClient.get(`/tests/sets/${testSetId}/runs`);
      const data = response.data as TestRun[];
      setRuns(data);
      setSelectedRunId((prev) => {
        if (prev && data.some((run) => run._id === prev)) return prev;
        return data[0]?._id ?? '';
      });
    } catch (error) {
      toast.error(error);
    }
  };

  const fetchRows = async (testRunId: string) => {
    setLoadingRows(true);
    try {
      const response = await apiClient.get(`/tests/runs/${testRunId}/results`);
      const data = response.data as { rows: TestRow[] };
      setRows(data.rows ?? []);
    } catch (error) {
      toast.error(error);
    } finally {
      setLoadingRows(false);
    }
  };

  const runSelectedSet = async () => {
    if (!selectedSetId) {
      toast.error('Select a test set first');
      return;
    }

    setRunning(true);
    try {
      const response = await apiClient.post(`/tests/sets/${selectedSetId}/run`);
      const data = response.data as { testRunId: string };
      toast.success('Test run completed');
      await fetchRuns(selectedSetId);
      if (data.testRunId) {
        setSelectedRunId(data.testRunId);
      }
    } catch (error) {
      toast.error(error);
    } finally {
      setRunning(false);
    }
  };

  const downloadResults = async (formatType: 'csv' | 'xlsx') => {
    if (!selectedRunId) {
      toast.error('Select a test run first');
      return;
    }

    try {
      const response = await apiClient.get(`/tests/runs/${selectedRunId}/download`, {
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
      a.download = `test-run-${selectedRunId}-results.${formatType}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Page>
      <Page.Header title="Results">
        <Input
          placeholder="Filter test sets"
          value={setFilter}
          onTextChange={setSetFilter}
        />
        <Button type="button" onClick={runSelectedSet} working={running}>
          Run selected set
        </Button>
        <Button type="button" variant="border" onClick={() => void downloadResults('xlsx')}>
          Download XLSX
        </Button>
        <Button type="button" variant="border" onClick={() => void downloadResults('csv')}>
          Download CSV
        </Button>
      </Page.Header>

      <Page.Content>
        <div className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2>Test sets</h2>
              <Button type="button" variant="border" onClick={() => void fetchSets()} working={loadingSets}>
                Refresh
              </Button>
            </div>

            <div className={styles.list}>
              {filteredSets.map((set) => (
                <button
                  key={set._id}
                  type="button"
                  className={set._id === selectedSetId ? styles.activeListItem : styles.listItem}
                  onClick={() => setSelectedSetId(set._id)}
                >
                  <strong>{set.name}</strong>
                  <span>{set.filename}</span>
                  <small>{format(new Date(set.createdAt), 'h:mma d MMM yyyy')}</small>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.runRow}>
              <label htmlFor="run-select">Run</label>
              <select
                id="run-select"
                value={selectedRunId}
                onChange={(event) => setSelectedRunId(event.target.value)}
              >
                <option value="">Select run</option>
                {runs.map((run) => (
                  <option key={run._id} value={run._id}>
                    {`${run.status} - ${format(new Date(run.createdAt), 'h:mma d MMM yyyy')}`}
                  </option>
                ))}
              </select>
            </div>

            {loadingRows && <Feedback type="loading" />}
            {!loadingRows && rows.length === 0 && selectedRunId && (
              <Feedback type="empty">No rows found for this run</Feedback>
            )}

            {rows.length > 0 && (
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
          </section>
        </div>
      </Page.Content>
    </Page>
  );
}

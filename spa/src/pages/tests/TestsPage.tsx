import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  project?: string | null;
  createdAt: string;
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

export default function TestsPage() {
  const navigate = useNavigate();
  const [keywords, setKeywords] = useState('');
  const [setName, setSetName] = useState('');
  const [project, setProject] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  const baseUrl = '/tests/sets';
  const [url, setUrl] = useState(baseUrl);
  const { data, setData, loading, reset } = usePagedRequest<TestSet>(url, { limit: 200 });

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
    if (setName.trim()) formData.append('name', setName.trim());
    if (project.trim()) formData.append('project', project.trim());

    setUploading(true);
    try {
      const response = await apiClient.post('/tests/upload', formData);
      const created = response.data as {
        testSetId: string;
        name: string;
        filename: string;
        project?: string | null;
      };

      setData((prev) => {
        const next = prev ? [...prev] : [];
        next.unshift({
          _id: created.testSetId,
          name: created.name,
          filename: created.filename,
          project: created.project ?? null,
          createdAt: new Date().toISOString(),
        });
        return next;
      });

      setSetName('');
      setProject('');
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
      <Page.Header title="Tests">
        <Input
          type="search"
          placeholder="Find test sets"
          value={keywords}
          onTextChange={setKeywords}
          onEnter={handleSearch}
        />
        <Input
          placeholder="Optional set name"
          value={setName}
          onTextChange={setSetName}
        />
        <Input
          placeholder="Optional project"
          value={project}
          onTextChange={setProject}
        />
        <IconButton icon="upload" onClick={selectFiles} />
        <IconButton icon="cached" onClick={reset} />
      </Page.Header>

      <Page.Content>
        <div className={styles.layout}>
          <div className={styles.list}>
            {uploading && <Feedback type="loading">Uploading test file...</Feedback>}
            {loading && <Feedback type="loading" />}
            {!loading && data?.length === 0 && <Feedback type="empty">No test sets found</Feedback>}

            {data?.map((testSet) => (
              <Button
                type="block"
                key={testSet._id}
                className={[styles.testSet, selectedSetId === testSet._id ? styles.active : ''].join(' ')}
                onClick={() => {
                  setSelectedSetId(testSet._id);
                  setPreviewVisible(true);
                }}
              >
                <Icon name="description" />
                <strong>{testSet.name}</strong>
                <span>{testSet.filename}</span>
                <small>{format(new Date(testSet.createdAt), 'h:mma d MMM yyyy')}</small>
              </Button>
            ))}
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
                <Button type="button" className={styles.openResultsButton} onClick={() => onOpenResults(testSetId)}>
                  View Results
                </Button>
              )}
            </>
          )}
        </div>
      </aside>
  );
}

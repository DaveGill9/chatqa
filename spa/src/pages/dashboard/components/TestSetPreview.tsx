import Button from '../../../components/button/Button';
import Feedback from '../../../components/feedback/Feedback';
import useFetchRequest from '../../../hooks/useFetchRequest';
import { stripFileExtension } from '../../../utils';
import type { TestSetDetail } from '../types';
import styles from '../DashboardPage.module.scss';

interface TestSetPreviewProps {
  testSetId: string | null;
  onClose: () => void;
}

export default function TestSetPreview({ testSetId, onClose }: TestSetPreviewProps) {
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
                  {extraEntries.length > 0 &&
                    extraEntries.map(([key, val]) => (
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

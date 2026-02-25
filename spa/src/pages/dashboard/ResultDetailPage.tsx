import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import useEmblaCarousel from 'embla-carousel-react';
import Page from '../../components/layout/Page';
import Button from '../../components/button/Button';
import Feedback from '../../components/feedback/Feedback';
import IconButton from '../../components/icon/IconButton';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import styles from './ResultDetailPage.module.scss';

type TestRow = {
  id: string;
  input: string;
  expected: string;
  actual?: string;
  score?: number;
  reasoning?: string;
  [key: string]: unknown;
};

type ResultSetMeta = {
  _id: string;
  name: string;
  filename: string;
  testSetName?: string | null;
  testSetFilename?: string | null;
  createdAt: string;
};

const stripFileExtension = (str: string) => {
  if (!str || typeof str !== 'string') return str;
  const lastDot = str.lastIndexOf('.');
  return lastDot > 0 ? str.slice(0, lastDot) : str;
};

export default function ResultDetailPage() {
  const { resultSetId } = useParams<{ resultSetId: string }>();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<ResultSetMeta | null>(null);
  const [rows, setRows] = useState<TestRow[] | null>(null);
  const [loading, setLoading] = useState(true);

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
        const response = await apiClient.get(`/tests/results/sets/${resultSetId}`);
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
            <Button type="button" className={styles.downloadBtn} onClick={() => void downloadResultSet(meta._id, 'xlsx')}>
              Download XLSX
            </Button>
            <Button type="button" variant="border" className={styles.downloadBtn} onClick={() => void downloadResultSet(meta._id, 'csv')}>
              Download CSV
            </Button>
          </div>
        )}
      </Page.Header>
      <Page.Content>
        {loading && <Feedback type="loading" />}
        {!loading && meta && rows && rows.length === 0 && <Feedback type="empty">No rows found</Feedback>}
        {!loading && meta && rows && rows.length > 0 && (
          <ResultCarousel rows={rows} />
        )}
      </Page.Content>
    </Page>
  );
}

function ResultCarousel({ rows }: { rows: TestRow[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps' });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

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
  }, [emblaApi, rows]);

  return (
    <div className={styles.content}>
      <div className={styles.carouselWrap}>
        <button
          type="button"
          className={styles.carouselBtn}
          onClick={scrollPrev}
          disabled={selectedIndex === 0}
          aria-label="Previous"
        >
          ‹
        </button>
        <div className={styles.embla} ref={emblaRef}>
          <div className={styles.emblaContainer}>
            {rows.map((row, index) => (
              <div key={`${row.id}-${index}`} className={styles.emblaSlide}>
                <div className={styles.caseCard}>
                  <div className={styles.caseCardHeader}>
                    <span className={styles.caseId}>Case {row.id}</span>
                    <span className={styles.caseScore}>{typeof row.score === 'number' ? row.score.toFixed(2) : '—'}</span>
                  </div>
                  <div className={styles.caseCardBody}>
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
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className={styles.carouselBtn}
          onClick={scrollNext}
          disabled={selectedIndex === rows.length - 1}
          aria-label="Next"
        >
          ›
        </button>
      </div>
    </div>
  );
}

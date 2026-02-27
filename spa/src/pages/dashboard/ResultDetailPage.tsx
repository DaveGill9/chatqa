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
import Popover from '../../components/popover/Popover';
import Modal from '../../components/popover/Modal';
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

type Evaluation = {
  summary?: string;
  whatWentWell?: string[];
  whatWentWrong?: string[];
  patterns?: string[];
  suggestions?: string[];
};

const stripFileExtension = (str: string) => {
  if (!str || typeof str !== 'string') return str;
  const lastDot = str.lastIndexOf('.');
  return lastDot > 0 ? str.slice(0, lastDot) : str;
};

/** Split actual into chat turns. Follow-ups are prefixed with [Follow-up N]: */
const RESPONSE_SEPARATOR = '\n---\n';
const FOLLOWUP_REGEX = /^\[Follow-up \d+\]:\s*/;

function parseChatTurns(input: string, actual: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  const turns: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  if (!input?.trim() && !actual?.trim()) return turns;

  turns.push({ role: 'user', content: (input || '').trim() || '—' });

  if (!actual?.trim()) return turns;

  const chunks = actual.split(RESPONSE_SEPARATOR).map((s) => s.trim()).filter(Boolean);
  for (const chunk of chunks) {
    const followupMatch = chunk.match(FOLLOWUP_REGEX);
    if (followupMatch) {
      const userMessage = chunk.replace(FOLLOWUP_REGEX, '').trim();
      if (userMessage) turns.push({ role: 'user', content: userMessage });
    } else {
      turns.push({ role: 'assistant', content: chunk });
    }
  }
  return turns;
}

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
            <Popover
              menu={
                <ul className={styles.downloadMenu}>
                  <li>
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        void downloadResultSet(meta._id, 'csv');
                        setDownloadMenuOpen(false);
                      }}
                    >
                      Download as CSV
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className={styles.menuItem}
                      onClick={() => {
                        void downloadResultSet(meta._id, 'xlsx');
                        setDownloadMenuOpen(false);
                      }}
                    >
                      Download as XLSX
                    </button>
                  </li>
                </ul>
              }
              visible={downloadMenuOpen}
              setVisible={setDownloadMenuOpen}
              position="bottom"
              anchor="right"
              className={styles.downloadPopover}
            >
              <Button type="button" className={styles.downloadBtn} variant="border">
                Download ▾
              </Button>
            </Popover>
          </div>
        )}
      </Page.Header>
      <Modal visible={evaluateModalOpen} onClose={() => setEvaluateModalOpen(false)}>
        <div className={styles.evalDialog}>
          {(evaluationLoading || !evaluation) && (
            <div className={styles.evalSkeleton} aria-busy="true" aria-label="Loading evaluation">
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonLine} style={{ width: '95%' }} />
              <div className={styles.skeletonLine} style={{ width: '88%' }} />
              <div className={styles.skeletonLine} style={{ width: '70%' }} />
              <div className={styles.skeletonSection} />
              <div className={styles.skeletonLine} style={{ width: '90%' }} />
              <div className={styles.skeletonLine} style={{ width: '75%' }} />
              <div className={styles.skeletonSection} />
              <div className={styles.skeletonLine} style={{ width: '85%' }} />
              <div className={styles.skeletonLine} style={{ width: '60%' }} />
            </div>
          )}
          {!evaluationLoading && evaluation && (
            <div className={styles.evalContent}>
              {evaluation.summary && (
                <section className={styles.evalSection}>
                  <h3>Summary</h3>
                  <p>{evaluation.summary}</p>
                </section>
              )}
              {evaluation.whatWentWell && evaluation.whatWentWell.length > 0 && (
                <section className={styles.evalSection}>
                  <h3>What went well</h3>
                  <ul>
                    {evaluation.whatWentWell.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              {evaluation.whatWentWrong && evaluation.whatWentWrong.length > 0 && (
                <section className={styles.evalSection}>
                  <h3>What went wrong</h3>
                  <ul>
                    {evaluation.whatWentWrong.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              {evaluation.patterns && evaluation.patterns.length > 0 && (
                <section className={styles.evalSection}>
                  <h3>Consistent patterns</h3>
                  <ul>
                    {evaluation.patterns.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
              {evaluation.suggestions && evaluation.suggestions.length > 0 && (
                <section className={styles.evalSection}>
                  <h3>Suggestions</h3>
                  <ul>
                    {evaluation.suggestions.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </Modal>
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

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const scrollToSection = useCallback((index: number, section: 'expected' | 'actual' | 'reasoning') => {
    scrollTo(index);
    const id = `section-${index}-${section}`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }, [scrollTo]);

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
        <aside className={styles.tocBox}>
          <span className={styles.tocTitle}>Table of contents</span>
          <nav className={styles.tocNav} aria-label="Case navigation">
            {rows.map((row, index) => (
              <div key={`${row.id}-${index}`} className={styles.tocCaseWrap}>
                <button
                  type="button"
                  className={selectedIndex === index ? styles.tocItemActive : styles.tocItem}
                  onClick={() => scrollTo(index)}
                  aria-current={selectedIndex === index ? 'true' : undefined}
                  aria-expanded={selectedIndex === index}
                >
                  Case {row.id}
                </button>
                <div
                  className={`${styles.tocSublistWrap} ${selectedIndex === index ? styles.tocSublistExpanded : ''}`}
                >
                  <ul className={styles.tocSublist}>
                    <li>
                      <button
                        type="button"
                        className={styles.tocSubitem}
                        onClick={() => scrollToSection(index, 'expected')}
                      >
                        Expected
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={styles.tocSubitem}
                        onClick={() => scrollToSection(index, 'actual')}
                      >
                        Actual
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={styles.tocSubitem}
                        onClick={() => scrollToSection(index, 'reasoning')}
                      >
                        Reasoning
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            ))}
          </nav>
        </aside>
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
                    <div id={`section-${index}-expected`} className={styles.caseCardSection}>
                      <span className={styles.caseLabel}>Expected</span>
                      <div className={[styles.caseValue, styles.caseValueMarkdown].join(' ')}>
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{row.expected || '—'}</ReactMarkdown>
                      </div>
                    </div>
                    <div id={`section-${index}-actual`} className={styles.chatThread}>
                      {parseChatTurns(row.input, row.actual ?? '').map((turn, i) => (
                        <div
                          key={i}
                          className={turn.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAssistant}
                        >
                          <span className={styles.chatRole}>{turn.role === 'user' ? 'You' : 'Assistant'}</span>
                          <div className={[styles.chatContent, styles.caseValueMarkdown].join(' ')}>
                            {turn.role === 'assistant' ? (
                              <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{turn.content}</ReactMarkdown>
                            ) : (
                              <>{turn.content}</>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div id={`section-${index}-reasoning`} className={styles.referenceSection}>
                      <div className={styles.caseCardSection}>
                        <span className={styles.caseLabel}>Reasoning</span>
                        <div className={[styles.caseValue, styles.caseValueMarkdown].join(' ')}>
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{row.reasoning || '—'}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

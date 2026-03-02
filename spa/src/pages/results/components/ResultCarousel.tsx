import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';
import useEmblaCarousel from 'embla-carousel-react';
import { parseChatTurns } from '../utils/parseChatTurns';
import type { TestRow } from '../types';
import styles from '../ResultDetailPage.module.scss';

interface ResultCarouselProps {
  rows: TestRow[];
}

export default function ResultCarousel({ rows }: ResultCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps' });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollTo = useCallback((index: number) => emblaApi?.scrollTo(index), [emblaApi]);

  const scrollToSection = useCallback(
    (index: number, section: 'expected' | 'actual' | 'reasoning') => {
      scrollTo(index);
      const id = `section-${index}-${section}`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });
    },
    [scrollTo],
  );

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
        <aside className={styles.tocBox} data-no-print>
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
                    <span className={styles.caseScore}>
                      {typeof row.score === 'number' ? row.score.toFixed(2) : '—'}
                    </span>
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
                          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                            {row.reasoning || '—'}
                          </ReactMarkdown>
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

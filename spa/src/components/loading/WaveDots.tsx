import styles from './WaveDots.module.scss';

export default function WaveDots({ className }: { className?: string }) {
  return (
    <div className={[styles.waveDots, className].filter(Boolean).join(' ')} aria-hidden>
      <span />
      <span />
      <span />
    </div>
  );
}

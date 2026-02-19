import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import styles from './AnimatedDetailLayout.module.scss';

interface AnimatedDetailLayoutProps {
  children: ReactNode;
  confirmClose?: boolean;
  width?: number | string;
  className?: string;
  onClose?: () => void;
}

export default function AnimatedDetailLayout({
  children,
  confirmClose,
  width = 800,
  className,
  onClose,
}: AnimatedDetailLayoutProps) {
  const navigate = useNavigate();

  const maxWidth = typeof width === 'number' ? `${width}px` : width;
  const classList = [styles.window, className].filter(Boolean).join(' ');

  const closeWindow = () => {
    if (confirmClose) return;
    if (onClose) {
      onClose();
      return;
    }
    navigate('../');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeWindow();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  });

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2 }}
      className={styles.page}
    >
      <button type="button" aria-label="Close detail view" className={styles.background} onClick={closeWindow} />
      <div className={classList} style={{ maxWidth }}>
        {children}
      </div>
    </motion.div>
  );
}

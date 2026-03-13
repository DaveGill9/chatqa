import { useEffect, useState } from 'react';
import Icon from '../../../components/icon/Icon';
import Input from '../../../components/input/Input';
import Button from '../../../components/button/Button';
import styles from '../DashboardPage.module.scss';

interface DashboardControlsProps {
  keywords: string;
  onSearch: (keywords: string) => void;
  onConvert: () => void;
  onUpload: () => void;
  uploading: boolean;
}

export default function DashboardControls({
  keywords,
  onSearch,
  onConvert,
  onUpload,
  uploading,
}: DashboardControlsProps) {
  const [draftKeywords, setDraftKeywords] = useState(keywords);

  useEffect(() => {
    setDraftKeywords(keywords);
  }, [keywords]);

  return (
    <div className={styles.controlsBar}>
      <div className={styles.searchWrap}>
        <Icon name="search" />
        <Input
          type="search"
          placeholder="Search test sets"
          value={draftKeywords}
          onTextChange={setDraftKeywords}
          onEnter={() => onSearch(draftKeywords.trim())}
          className={styles.searchInput}
        />
      </div>
      <div className={styles.buttonGroup}>
        <Button type="button" className={styles.uploadButton} onClick={onConvert} disabled={uploading}>
          <Icon name="swap_horiz" /> Convert format
        </Button>
        <Button type="button" className={styles.uploadButton} onClick={onUpload} disabled={uploading}>
          <Icon name="upload" /> {uploading ? 'Uploading…' : 'Upload Test Set'}
        </Button>
      </div>
    </div>
  );
}

import Button from '../../../components/button/Button';
import Popover from '../../../components/popover/Popover';
import styles from '../ResultDetailPage.module.scss';

interface ResultDownloadMenuProps {
  resultSetId: string;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  onDownloadCsv: (id: string) => void;
  onDownloadXlsx: (id: string) => void;
}

export default function ResultDownloadMenu({
  resultSetId,
  visible,
  onVisibleChange,
  onDownloadCsv,
  onDownloadXlsx,
}: ResultDownloadMenuProps) {
  return (
    <Popover
      menu={
        <ul className={styles.downloadMenu}>
          <li>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                void onDownloadCsv(resultSetId);
                onVisibleChange(false);
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
                void onDownloadXlsx(resultSetId);
                onVisibleChange(false);
              }}
            >
              Download as XLSX
            </button>
          </li>
          <li>
            <button
              type="button"
              className={styles.menuItem}
              onClick={() => {
                window.print();
                onVisibleChange(false);
              }}
            >
              Download as PDF
            </button>
          </li>
        </ul>
      }
      visible={visible}
      setVisible={onVisibleChange}
      position="bottom"
      anchor="right"
      className={styles.downloadPopover}
    >
      <Button type="button" className={styles.downloadBtn} variant="border">
        Download ▾
      </Button>
    </Popover>
  );
}

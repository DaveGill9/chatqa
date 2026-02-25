import { useState, useRef } from 'react';
import Modal from '../../components/popover/Modal';
import Button from '../../components/button/Button';
import Icon from '../../components/icon/Icon';
import Textarea from '../../components/input/Textarea';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import styles from './ConvertFormatDialog.module.scss';

interface ConvertFormatDialogProps {
  visible: boolean;
  onClose: () => void;
  onConverted?: (created: { testSetId: string; name: string; filename?: string; testCaseCount: number }) => void;
}

export default function ConvertFormatDialog({
  visible,
  onClose,
  onConverted,
}: ConvertFormatDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [converting, setConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      const ext = (selected.name.split('.').pop() || '').toLowerCase();
      if (['csv', 'xlsx', 'xls'].includes(ext)) {
        setFile(selected);
      } else {
        toast.error('Please select a CSV or Excel file');
      }
    }
    e.target.value = '';
  };

  const handleConvert = async () => {
    if (!file) {
      toast.error('Please select a file');
      return;
    }

    setConverting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (prompt.trim()) {
        formData.append('prompt', prompt.trim());
      }

      const response = await apiClient.post('/tests/convert', formData);
      const created = response.data as {
        testSetId: string;
        name: string;
        filename: string;
        testCaseCount: number;
      };

      toast.success(`Converted and uploaded: ${created.testCaseCount} test cases`);
      onConverted?.(created);
      handleClose();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPrompt('');
    onClose();
  };

  return (
    <Modal visible={visible} onClose={handleClose}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <Icon name="swap_horiz" />
          <h2>Convert to test format</h2>
        </div>
        <p className={styles.description}>
          Upload a file with arbitrary columns (e.g. input, output, guidance, do-not-dos).
          AI will convert it to the required format: <strong>id</strong>, <strong>input</strong>, <strong>expected</strong>.
        </p>

        <div className={styles.field}>
          <label className={styles.label}>File</label>
          <div className={styles.fileRow}>
            <Button
              type="button"
              variant="border"
              onClick={handleSelectFile}
              disabled={converting}
            >
              <Icon name="upload" /> {file ? file.name : 'Choose file'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className={styles.hiddenInput}
              aria-hidden
            />
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>
            Additional instructions <span className={styles.optional}>(optional)</span>
          </label>
          <Textarea
            placeholder="E.g. The 'output' column contains the expected answer. Use 'guidance' to enrich the input. Combine do-not-dos into the expected field..."
            value={prompt}
            onTextChange={setPrompt}
            rows={3}
            className={styles.promptInput}
            disabled={converting}
          />
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="border" onClick={handleClose} disabled={converting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="accent"
            onClick={handleConvert}
            disabled={!file || converting}
          >
            {converting ? 'Converting…' : 'Convert & upload'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

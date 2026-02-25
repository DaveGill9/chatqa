import { useState, useRef, useEffect } from 'react';
import Modal from '../../components/popover/Modal';
import Button from '../../components/button/Button';
import Icon from '../../components/icon/Icon';
import Textarea from '../../components/input/Textarea';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import { useJobs } from '../../context/JobsContext';
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
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { jobs } = useJobs();

  useEffect(() => {
    if (!pendingJobId) return;
    const job = jobs.find((j) => j.id === pendingJobId);
    if (!job) return;
    if (job.status === 'completed' && job.meta?.testSetId) {
      onConverted?.({
        testSetId: job.meta.testSetId,
        name: job.meta.testSetName ?? 'Converted',
        filename: job.meta.filename,
        testCaseCount: job.meta.testCaseCount ?? 0,
      });
      toast.success(`Converted and uploaded: ${job.meta.testCaseCount ?? 0} test cases`);
      setPendingJobId(null);
      setConverting(false);
      onClose();
    } else if (job.status === 'failed') {
      toast.error(job.detail || 'Conversion failed');
      setPendingJobId(null);
      setConverting(false);
    }
  }, [jobs, pendingJobId, onConverted, onClose]);

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
      const { jobId } = response.data as { jobId: string };
      setPendingJobId(jobId);
      toast.info('Conversion started. Watch the Jobs panel for progress.');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : err instanceof Error ? err.message : String(err);
      toast.error(msg || 'Conversion failed');
      setConverting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPrompt('');
    setPendingJobId(null);
    onClose();
  };

  return (
    <Modal visible={visible} onClose={handleClose}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2>Convert Format</h2>
        </div>
        <p className={styles.description}>
          Upload a file with any columns. AI converts it to: <strong>id</strong>, <strong>input</strong>, <strong>expected</strong>.
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
            placeholder="E.g. 'output' = expected answer, 'guidance' enriches input"
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

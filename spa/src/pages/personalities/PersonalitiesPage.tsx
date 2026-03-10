import { useState } from 'react';
import Button from '../../components/button/Button';
import Feedback from '../../components/feedback/Feedback';
import Icon from '../../components/icon/Icon';
import IconButton from '../../components/icon/IconButton';
import Input from '../../components/input/Input';
import Page from '../../components/layout/Page';
import Textarea from '../../components/input/Textarea';
import Alert from '../../components/popover/Alert';
import Modal from '../../components/popover/Modal';
import usePagedRequest from '../../hooks/usePagedRequest';
import apiClient from '../../services/api-client';
import { toast } from '../../services/toast-service';
import { addSearchParams } from '../../utils';
import styles from './PersonalitiesPage.module.scss';

interface Personality {
  _id: string;
  name: string;
  description?: string;
  instructions: string;
  createdAt: string;
  updatedAt: string;
}

interface PersonalityFormState {
  name: string;
  description: string;
  instructions: string;
}

const emptyForm: PersonalityFormState = {
  name: '',
  description: '',
  instructions: '',
};

function sortPersonalities(list: Personality[]) {
  return list.slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}

export default function PersonalitiesPage() {
  const [keywords, setKeywords] = useState('');
  const [appliedKeywords, setAppliedKeywords] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingPersonality, setEditingPersonality] = useState<Personality | null>(null);
  const [deleteConfirmPersonality, setDeleteConfirmPersonality] = useState<Personality | null>(null);
  const [form, setForm] = useState<PersonalityFormState>(emptyForm);

  const personalitiesUrl = addSearchParams(
    '/personalities',
    appliedKeywords ? { keywords: appliedKeywords } : {},
  );
  const {
    data: personalities,
    setData: setPersonalities,
    loading,
    reset,
  } = usePagedRequest<Personality>(personalitiesUrl, { limit: 200 });

  const updateForm = (field: keyof PersonalityFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = () => {
    setAppliedKeywords(keywords.trim());
  };

  const handleOpenCreate = () => {
    setEditingPersonality(null);
    setForm(emptyForm);
    setEditorVisible(true);
  };

  const handleOpenEdit = (personality: Personality) => {
    setEditingPersonality(personality);
    setForm({
      name: personality.name,
      description: personality.description ?? '',
      instructions: personality.instructions,
    });
    setEditorVisible(true);
  };

  const handleCloseEditor = () => {
    if (saving) return;
    setEditorVisible(false);
    setEditingPersonality(null);
    setForm(emptyForm);
  };

  const handleSave = async () => {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      instructions: form.instructions.trim(),
    };

    if (!payload.name || !payload.instructions) {
      toast.error('Name and instructions are required');
      return;
    }

    setSaving(true);
    try {
      if (editingPersonality) {
        const response = await apiClient.patch(`/personalities/${editingPersonality._id}`, payload);
        const updated = response.data as Personality;
        setPersonalities((prev) => sortPersonalities((prev ?? []).map((item) => (
          item._id === updated._id ? updated : item
        ))));
        toast.success('Personality updated');
      } else {
        const response = await apiClient.post('/personalities', payload);
        const created = response.data as Personality;
        setPersonalities((prev) => sortPersonalities([created, ...(prev ?? [])]));
        toast.success('Personality created');
      }
      handleCloseEditor();
    } catch (error) {
      toast.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmPersonality) return;

    try {
      await apiClient.delete(`/personalities/${deleteConfirmPersonality._id}`);
      setPersonalities((prev) => (prev ?? []).filter((item) => item._id !== deleteConfirmPersonality._id));
      toast.success('Personality deleted');
      setDeleteConfirmPersonality(null);
    } catch (error) {
      toast.error(error);
    }
  };

  return (
    <Page>
      <Page.Header
        title="Personalities"
        subtitle="Manage reusable writing styles for AI-generated test inputs."
      >
        <div className={styles.headerActions}>
          <Input
            type="search"
            placeholder="Search personalities"
            value={keywords}
            onTextChange={setKeywords}
            onEnter={handleSearch}
            className={styles.searchInput}
          />
          <IconButton icon="cached" onClick={() => reset()} />
          <Button type="button" variant="accent" onClick={handleOpenCreate}>
            <Icon name="add" /> Add personality
          </Button>
        </div>
      </Page.Header>
      <Page.Content>
        <div className={styles.page}>
          {loading && <Feedback type="loading" />}

          {!loading && (!personalities || personalities.length === 0) && (
            <Feedback type="empty" title={appliedKeywords ? 'No matching personalities' : 'No personalities yet'}>
              {appliedKeywords
                ? 'Try a different search term or clear the filter.'
                : 'Create a personality to control how AI-generated user inputs are written.'}
            </Feedback>
          )}

          {!!personalities?.length && (
            <div className={styles.list}>
              {personalities.map((personality) => (
                <div key={personality._id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <div className={styles.titleBlock}>
                      <h3>{personality.name}</h3>
                      {personality.description && (
                        <p className={styles.description}>{personality.description}</p>
                      )}
                    </div>
                    <div className={styles.actions}>
                      <Button
                        type="button"
                        variant="border"
                        onClick={() => handleOpenEdit(personality)}
                      >
                        <Icon name="edit" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="border"
                        onClick={() => setDeleteConfirmPersonality(personality)}
                      >
                        <Icon name="delete" /> Delete
                      </Button>
                    </div>
                  </div>
                  <p className={styles.instructions}>{personality.instructions}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Page.Content>

      <Modal visible={editorVisible} onClose={handleCloseEditor}>
        <div className={styles.dialog}>
          <div className={styles.dialogHeader}>
            <h2>{editingPersonality ? 'Edit personality' : 'Add personality'}</h2>
            <p>These instructions are added on top of the existing OpenAI system prompt.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Name</label>
            <Input
              type="text"
              placeholder="E.g. Pirate"
              value={form.name}
              onTextChange={(value) => updateForm('name', value)}
              disabled={saving}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Description <span className={styles.optional}>(optional)</span>
            </label>
            <Input
              type="text"
              placeholder="Short summary shown in the list"
              value={form.description}
              onTextChange={(value) => updateForm('description', value)}
              disabled={saving}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Instructions</label>
            <Textarea
              placeholder="Write in a pirate voice, use nautical language, and keep the user intent the same."
              value={form.instructions}
              onTextChange={(value) => updateForm('instructions', value)}
              disabled={saving}
              rows={6}
              autoresize={false}
              className={styles.instructionsInput}
            />
          </div>

          <div className={styles.dialogActions}>
            <Button type="button" variant="border" onClick={handleCloseEditor} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="accent" onClick={handleSave} working={saving}>
              {editingPersonality ? 'Save changes' : 'Create personality'}
            </Button>
          </div>
        </div>
      </Modal>

      <Alert
        title="Delete personality"
        visible={!!deleteConfirmPersonality}
        setVisible={(visible) => {
          if (!visible) setDeleteConfirmPersonality(null);
        }}
        confirmText="Delete"
        onConfirm={handleDelete}
      >
        {deleteConfirmPersonality
          ? `Delete "${deleteConfirmPersonality.name}"?`
          : 'Delete this personality?'}
      </Alert>
    </Page>
  );
}

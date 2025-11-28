import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { Project } from '../../types/project';
import ScrollableList, { ScrollableListItem } from '../ScrollableList/ScrollableList';
import './NewProjectPanel.css';

type NewProjectPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  projectTypes: ScrollableListItem[];
  selectedProjectTypeId: string;
  onSelectProjectType: (id: string) => void;
  onProjectCreated?: (project: Project) => void;
};

function NewProjectPanel({
  isOpen,
  onClose,
  projectTypes,
  selectedProjectTypeId,
  onSelectProjectType,
  onProjectCreated,
}: NewProjectPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const selectedProjectType = useMemo(
    () => projectTypes.find((type) => type.id === selectedProjectTypeId),
    [projectTypes, selectedProjectTypeId],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName('');
    setDescription('');
    setError(null);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    const insertPayload = {
      user_id: user.id,
      name: name.trim(),
      project_type: selectedProjectTypeId,
      description: description.trim() || null,
      config: {},
    };

    const { data, error: insertError } = await supabase
      .from('projects')
      .insert([insertPayload])
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
      return;
    }

    const createdProject = data as Project;
    onProjectCreated?.(createdProject);
    setIsSubmitting(false);
    onClose();
    navigate(`/workspace/${selectedProjectTypeId}/${createdProject.id}`);
  };

  return (
    <div className="new-project-overlay" onClick={onClose} role="presentation">
      <div
        className="new-project-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="new-project-panel__column new-project-panel__column--left">
          <div className="new-project-panel__header">
            <h2 id="new-project-title">New Project</h2>
            <p className="new-project-panel__subtitle muted">Choose a project type to get started.</p>
          </div>

          <ScrollableList
            items={projectTypes}
            selectedId={selectedProjectTypeId}
            onSelect={onSelectProjectType}
          />
        </div>

        <div className="new-project-panel__column new-project-panel__column--right">
          <h3 className="new-project-panel__selection-title">
            {selectedProjectType ? selectedProjectType.label : 'Select a project type'}
          </h3>

          <form className="new-project-form" onSubmit={handleSubmit}>
            <div className="new-project-form__group">
              <label className="new-project-form__label" htmlFor="project-name">
                Project Name
              </label>
              <input
                id="project-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter a project name"
                required
              />
            </div>

            <div className="new-project-form__group">
              <label className="new-project-form__label" htmlFor="project-description">
                Description <span className="muted">(optional)</span>
              </label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Add a short summary for this project"
              />
            </div>

            {error ? <p className="new-project-form__error">{error}</p> : null}

            <div className="new-project-form__actions">
              <button className="button button--ghost" type="button" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="button" type="submit" disabled={!name.trim() || isSubmitting}>
                {isSubmitting ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default NewProjectPanel;

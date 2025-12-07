import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { Project } from '../../types/project';
import ScrollableList, { ScrollableListItem } from '../ScrollableList/ScrollableList';
import PixelCard from '../PixelCard/PixelCard';
import { generateClientId } from '../../lib/utils';
import './NewProjectPanel.css';

type NewProjectPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  projectTypes: ScrollableListItem[];
  selectedProjectTypeId: string;
  onSelectProjectType: (id: string) => void;
  onProjectCreated?: (project: Project) => void;
  existingProjects?: Project[];
};

function NewProjectPanel({
  isOpen,
  onClose,
  projectTypes,
  selectedProjectTypeId,
  onSelectProjectType,
  onProjectCreated,
  existingProjects = [],
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

  // Canvas-specific configuration
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const [canvasHeight, setCanvasHeight] = useState(1000);
  const [canvasColor, setCanvasColor] = useState('#ffffff');

  // Generate auto-placeholder for canvas projects
  // Count the actual canvas projects from the database
  const canvasProjectNumber = useMemo(() => {
    const canvasProjectCount = existingProjects.filter(p => p.project_type === 'canvas').length;
    return canvasProjectCount + 1;
  }, [existingProjects]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setName('');
    setDescription('');
    setError(null);
    setCanvasWidth(1000);
    setCanvasHeight(1000);
    setCanvasColor('#ffffff');
  }, [isOpen]);

  const isCanvasProject = selectedProjectTypeId === 'canvas';

  // Calculate preview dimensions to fit within a square preview box
  // The preview box is 280x280px (defined in CSS)
  const PREVIEW_BOX_SIZE = 280;
  const aspectRatio = canvasWidth / canvasHeight;

  // Calculate preview dimensions based on aspect ratio
  // The largest canvas dimension should scale to fit the preview box
  let previewWidth: number;
  let previewHeight: number;

  if (canvasWidth >= canvasHeight) {
    // Width is larger - scale width to preview box size
    previewWidth = PREVIEW_BOX_SIZE;
    previewHeight = PREVIEW_BOX_SIZE / aspectRatio;
  } else {
    // Height is larger - scale height to preview box size
    previewHeight = PREVIEW_BOX_SIZE;
    previewWidth = PREVIEW_BOX_SIZE * aspectRatio;
  }

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    setError(null);

    // Use auto-generated name if field is empty for canvas projects
    const finalName = name.trim() || (isCanvasProject ? `Canvas Project #${canvasProjectNumber}` : '');

    if (!finalName) {
      setError('Project name is required');
      setIsSubmitting(false);
      return;
    }

    const config = isCanvasProject
      ? {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: canvasColor,
        }
      : {};

    const insertPayload = {
      user_id: user.id,
      name: finalName,
      project_type: selectedProjectTypeId,
      description: description.trim() || null,
      config,
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

    // For canvas projects, create the initial canvas with background layer
    if (isCanvasProject) {
      await createInitialCanvas(createdProject.id);
    }

    // For battle-maps projects, create the initial battle map
    if (selectedProjectTypeId === 'battle-maps') {
      await createInitialBattleMap(createdProject.id);
    }

    onProjectCreated?.(createdProject);
    setIsSubmitting(false);
    onClose();
    navigate(`/workspace/${selectedProjectTypeId}/${createdProject.id}`);
  };

  const createInitialCanvas = async (projectId: string) => {
    if (!user) return;

    try {
      const backgroundLayerId = generateClientId();
      const defaultLayerId = generateClientId();

      const initialCanvasData = {
        layers: [
          {
            id: backgroundLayerId,
            name: 'Background',
            visible: true,
            order: 0,
            strokes: [],
          },
          {
            id: defaultLayerId,
            name: 'Layer 1',
            visible: true,
            order: 1,
            strokes: [],
          },
        ],
        activeLayerId: defaultLayerId,
        version: 2,
      };

      await supabase.from('canvases').insert({
        project_id: projectId,
        user_id: user.id,
        canvas_data: initialCanvasData,
      });
    } catch (error) {
      console.error('Failed to create initial canvas:', error);
    }
  };

  const createInitialBattleMap = async (projectId: string) => {
    if (!user) return;

    try {
      await supabase.from('battle_maps').insert({
        project_id: projectId,
        width: 30,
        height: 30,
        tile_size: 48,
        grid_type: 'square',
      });
    } catch (error) {
      console.error('Failed to create initial battle map:', error);
    }
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
          {isCanvasProject ? (
            <div className="new-project-canvas-layout">
              {/* Left: Form */}
              <div className="new-project-canvas-column">
                <h3 className="new-project-panel__selection-title">{selectedProjectType?.label}</h3>
                <form className="new-project-canvas-form" onSubmit={handleSubmit}>
                  <div className="new-project-form__group">
                    <label className="new-project-form__label" htmlFor="canvas-name">
                      Canvas Name
                    </label>
                    <input
                      id="canvas-name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder={`Canvas Project #${canvasProjectNumber}`}
                      className="new-project-form__input"
                    />
                  </div>

                  <div className="new-project-canvas-divider" />

                  <div className="new-project-form__grid">
                    <div className="new-project-form__group">
                      <label className="new-project-form__label" htmlFor="canvas-width">
                        Width
                      </label>
                      <div className="new-project-form__input-with-unit">
                        <input
                          id="canvas-width"
                          type="number"
                          value={canvasWidth}
                          onChange={(event) => setCanvasWidth(Number(event.target.value))}
                          min="100"
                          max="10000"
                          required
                          className="new-project-form__input"
                        />
                        <span className="new-project-form__unit">px</span>
                      </div>
                    </div>

                    <div className="new-project-form__group">
                      <label className="new-project-form__label" htmlFor="canvas-height">
                        Height
                      </label>
                      <div className="new-project-form__input-with-unit">
                        <input
                          id="canvas-height"
                          type="number"
                          value={canvasHeight}
                          onChange={(event) => setCanvasHeight(Number(event.target.value))}
                          min="100"
                          max="10000"
                          required
                          className="new-project-form__input"
                        />
                        <span className="new-project-form__unit">px</span>
                      </div>
                    </div>
                  </div>

                  <div className="new-project-form__group">
                    <label className="new-project-form__label" htmlFor="canvas-color">
                      Background Color
                    </label>
                    <input
                      id="canvas-color"
                      type="color"
                      value={canvasColor}
                      onChange={(event) => setCanvasColor(event.target.value)}
                      className="new-project-form__color-input-circle"
                      title={canvasColor}
                    />
                  </div>

                  {error ? <p className="new-project-form__error">{error}</p> : null}

                  <div className="new-project-form__actions">
                    <button className="button button--ghost" type="button" onClick={onClose} disabled={isSubmitting}>
                      Cancel
                    </button>
                    <button className="button button--primary" type="submit" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating…' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right: Preview */}
              <div className="new-project-canvas-column">
                <h3 className="new-project-canvas-preview__label">Preview</h3>
                <div className="new-project-canvas-preview__container">
                  <div
                    className="new-project-canvas-preview__card"
                    style={{ width: `${previewWidth}px`, height: `${previewHeight}px` }}
                  >
                    <PixelCard variant="gold">
                      <div
                        className="new-project-canvas-preview__inner"
                        style={{ backgroundColor: canvasColor }}
                      />
                    </PixelCard>
                  </div>
                  <p className="new-project-canvas-preview__dimensions">
                    {canvasWidth} × {canvasHeight} px
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <h3 className="new-project-panel__selection-title">
                {selectedProjectType?.label}
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
                  className="new-project-form__input"
                  required
                />
              </div>

              <div className="new-project-form__group">
                <label className="new-project-form__label" htmlFor="project-description">
                  Description <span className="new-project-form__optional">(optional)</span>
                </label>
                <textarea
                  id="project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Add a short summary for this project"
                  className="new-project-form__input"
                />
              </div>

              {error ? <p className="new-project-form__error">{error}</p> : null}

              <div className="new-project-form__actions">
                <button className="button button--ghost" type="button" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </button>
                <button className="button button--primary" type="submit" disabled={!name.trim() || isSubmitting}>
                  {isSubmitting ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default NewProjectPanel;

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { Project } from '../../types/project';
import ScrollableList, { ScrollableListItem } from '../ScrollableList/ScrollableList';
import PixelCard from '../PixelCard/PixelCard';
import { generateClientId } from '../../lib/utils';
import {
  DEFAULT_BATTLE_MAP_CONFIG,
  DEFAULT_HEX_BATTLE_MAP_CONFIG,
  persistBattleMapState,
} from '../../services/battleMapStorage';
import type { BattleMapConfig, GridType } from '../../types/battlemap';
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
  const [battleMapColumns, setBattleMapColumns] = useState(DEFAULT_BATTLE_MAP_CONFIG.gridColumns);
  const [battleMapRows, setBattleMapRows] = useState(DEFAULT_BATTLE_MAP_CONFIG.gridRows);
  const [gridType, setGridType] = useState<GridType>('square');
  const [hexSize, setHexSize] = useState(
    DEFAULT_HEX_BATTLE_MAP_CONFIG.hexSettings?.hexSize ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.cellSize,
  );

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
    setBattleMapColumns(DEFAULT_BATTLE_MAP_CONFIG.gridColumns);
    setBattleMapRows(DEFAULT_BATTLE_MAP_CONFIG.gridRows);
    setGridType('square');
    setHexSize(DEFAULT_HEX_BATTLE_MAP_CONFIG.hexSettings?.hexSize ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.cellSize);
  }, [isOpen]);

  const isCanvasProject = selectedProjectTypeId === 'canvas';
  const isBattleMapProject = selectedProjectTypeId === 'battle-maps';

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

    const normalizedColumns =
      Math.max(1, battleMapColumns || DEFAULT_BATTLE_MAP_CONFIG.gridColumns);
    const normalizedRows = Math.max(1, battleMapRows || DEFAULT_BATTLE_MAP_CONFIG.gridRows);
    const normalizedHexSize = Math.max(
      20,
      hexSize || (DEFAULT_HEX_BATTLE_MAP_CONFIG.hexSettings?.hexSize ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.cellSize),
    );
    const hexRadius = Math.max(1, normalizedColumns);

    const config: Partial<BattleMapConfig> | Record<string, unknown> = isCanvasProject
      ? {
          width: canvasWidth,
          height: canvasHeight,
          backgroundColor: canvasColor,
        }
        : isBattleMapProject
        ? gridType === 'hex'
          ? {
              gridType,
              gridColumns: hexRadius * 2 - 1,
              gridRows: hexRadius * 2 - 1,
              cellSize: normalizedHexSize,
              widgets: [],
              hexSettings: {
                hexSize: normalizedHexSize,
                orientation: 'flat',
                hexRadius,
              },
              hexWidgets: [],
              version: DEFAULT_HEX_BATTLE_MAP_CONFIG.version,
            }
          : {
              gridType,
              gridColumns: normalizedColumns,
              gridRows: normalizedRows,
              cellSize: DEFAULT_BATTLE_MAP_CONFIG.cellSize,
              widgets: [],
              version: DEFAULT_BATTLE_MAP_CONFIG.version,
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
    if (isBattleMapProject) {
      await createInitialBattleMap(createdProject.id, normalizedColumns, normalizedRows, gridType, {
        hexSize: normalizedHexSize,
      });
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

  const createInitialBattleMap = async (
    projectId: string,
    gridColumns: number,
    gridRows: number,
    selectedGridType: GridType,
    hexConfig?: { hexSize: number },
  ) => {
    if (!user) return;

    const hexSizeValue =
      hexConfig?.hexSize ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.hexSettings?.hexSize ?? DEFAULT_HEX_BATTLE_MAP_CONFIG.cellSize;

    const initialConfig: BattleMapConfig =
      selectedGridType === 'hex'
        ? {
            gridType: 'hex',
            gridColumns: gridColumns * 2 - 1,
            gridRows: gridColumns * 2 - 1,
            cellSize: hexSizeValue,
            widgets: [],
            hexSettings: {
              hexSize: hexSizeValue,
              orientation: 'flat',
              hexRadius: gridColumns,
            },
            hexWidgets: [],
            version: DEFAULT_HEX_BATTLE_MAP_CONFIG.version,
          }
        : {
            gridType: 'square',
            gridColumns,
            gridRows,
            cellSize: DEFAULT_BATTLE_MAP_CONFIG.cellSize,
            widgets: [],
            version: DEFAULT_BATTLE_MAP_CONFIG.version,
          };

    try {
      await persistBattleMapState({
        projectId,
        userId: user.id,
        config: initialConfig,
      });

      await supabase.from('battle_maps').insert({
        project_id: projectId,
        width: selectedGridType === 'hex' ? 0 : gridColumns,
        height: selectedGridType === 'hex' ? 0 : gridRows,
        tile_size: initialConfig.cellSize,
        grid_type: selectedGridType,
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

              {isBattleMapProject ? (
                <>
                  <div className="new-project-form__group">
                    <span className="new-project-form__label">Grid Type</span>
                    <div className="new-project-form__radio-group">
                      <label className="new-project-form__radio">
                        <input
                          type="radio"
                          name="battlemap-grid-type"
                          value="square"
                          checked={gridType === 'square'}
                          onChange={() => setGridType('square')}
                        />
                        <span>Square (GridStack)</span>
                      </label>
                      <label className="new-project-form__radio">
                        <input
                          type="radio"
                          name="battlemap-grid-type"
                          value="hex"
                          checked={gridType === 'hex'}
                          onChange={() => setGridType('hex')}
                        />
                        <span>Hex</span>
                      </label>
                    </div>
                  </div>
                  {gridType === 'square' ? (
                    <>
                      <div className="new-project-form__grid">
                        <div className="new-project-form__group">
                          <label className="new-project-form__label" htmlFor="battlemap-columns">
                            Columns
                          </label>
                          <input
                            id="battlemap-columns"
                            type="number"
                            min="1"
                            max="50"
                            value={battleMapColumns}
                            onChange={(event) => setBattleMapColumns(Number(event.target.value))}
                            className="new-project-form__input"
                            required
                          />
                        </div>
                        <div className="new-project-form__group">
                          <label className="new-project-form__label" htmlFor="battlemap-rows">
                            Rows
                          </label>
                          <input
                            id="battlemap-rows"
                            type="number"
                            min="1"
                            max="50"
                            value={battleMapRows}
                            onChange={(event) => setBattleMapRows(Number(event.target.value))}
                            className="new-project-form__input"
                            required
                          />
                        </div>
                      </div>
                      <p className="new-project-form__optional">
                        Set the starting grid size (default 12 columns by 8 rows). You can expand later.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="new-project-form__grid">
                        <div className="new-project-form__group">
                          <label className="new-project-form__label" htmlFor="battlemap-columns">
                            Radius (hexes from center)
                          </label>
                          <input
                            id="battlemap-columns"
                            type="number"
                            min="1"
                            max="50"
                            value={battleMapColumns}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              setBattleMapColumns(value);
                              setBattleMapRows(value);
                            }}
                            className="new-project-form__input"
                            required
                          />
                        </div>
                        <div className="new-project-form__group">
                          <label className="new-project-form__label" htmlFor="battlemap-hex-size">
                            Hex Size (px)
                          </label>
                          <input
                            id="battlemap-hex-size"
                            type="number"
                            min="20"
                            max="200"
                            value={hexSize}
                            onChange={(event) => setHexSize(Number(event.target.value))}
                            className="new-project-form__input"
                            required
                          />
                        </div>
                      </div>
                      <p className="new-project-form__optional">
                        Hex grids are hexagonal; radius controls size. Orientation is flat-top.
                      </p>
                    </>
                  )}
                </>
              ) : null}

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

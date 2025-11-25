import {
  DragEvent,
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ReactSketchCanvas, type CanvasPath, type ReactSketchCanvasRef } from 'react-sketch-canvas';
import { supabase } from '../../lib/supabaseClient';
import type { Project } from '../../types/project';

export type EditorTool = 'move' | 'brush' | 'eraser' | 'select';

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
};

export type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasWorkspaceProps = {
  project: Project;
};

type CanvasSettings = {
  zoom?: number;
  pan?: { x: number; y: number };
  activeTool?: EditorTool;
  activeLayerId?: string;
  layers?: Layer[];
  brush?: { color: string; width: number };
  eraser?: { width: number };
};

const defaultLayer: Layer = {
  id: 'layer-1',
  name: 'Layer 1',
  visible: true,
  locked: false,
};

const defaultBrush = { color: '#ffffff', width: 6 };
const defaultEraser = { width: 24 };

function CanvasWorkspace({ project }: CanvasWorkspaceProps) {
  const canvasRef = useRef<ReactSketchCanvasRef | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const hasLoadedPathsRef = useRef(false);
  const previousToolRef = useRef<EditorTool | null>(null);
  const dragLayerIdRef = useRef<string | null>(null);
  const selectionRect = useMemo(() => {
    if (!selection) return null;
    const left = Math.min(selection.x, selection.x + selection.width);
    const top = Math.min(selection.y, selection.y + selection.height);
    const width = Math.abs(selection.width);
    const height = Math.abs(selection.height);
    return { left, top, width, height };
  }, [selection]);

  const canvasSettings = useMemo(() => {
    const config = (project.config ?? {}) as Record<string, unknown>;
    return (config.canvasSettings as CanvasSettings | undefined) ?? {};
  }, [project.config]);

  const [editorState, setEditorState] = useState(() => ({
    zoom: canvasSettings.zoom ?? 1,
    pan: canvasSettings.pan ?? { x: 0, y: 0 },
    activeTool: canvasSettings.activeTool ?? ('brush' as EditorTool),
    activeLayerId: canvasSettings.activeLayerId ?? defaultLayer.id,
    layers: canvasSettings.layers ?? [defaultLayer],
    selection: null as SelectionBox | null,
    brush: canvasSettings.brush ?? defaultBrush,
    eraser: canvasSettings.eraser ?? defaultEraser,
  }));

  useEffect(() => {
    const config = (project.config ?? {}) as Record<string, unknown>;
    const settings = (config.canvasSettings as CanvasSettings | undefined) ?? {};
    const layers = settings.layers ?? [defaultLayer];
    setEditorState((prev) => ({
      ...prev,
      zoom: settings.zoom ?? prev.zoom,
      pan: settings.pan ?? prev.pan,
      activeTool: settings.activeTool ?? prev.activeTool,
      activeLayerId: settings.activeLayerId ?? layers[0]?.id ?? prev.activeLayerId,
      layers,
      brush: settings.brush ?? prev.brush,
      eraser: settings.eraser ?? prev.eraser,
    }));
    hasLoadedPathsRef.current = false;
  }, [project.id, project.config]);

  useEffect(() => {
    if (!project || !canvasRef.current || hasLoadedPathsRef.current) {
      return;
    }

    const config = (project.config ?? {}) as Record<string, unknown>;
    const paths = config.canvasPaths as CanvasPath[] | undefined;

    if (paths) {
      try {
        canvasRef.current.loadPaths(paths);
      } catch (err) {
        console.error('Failed to load canvas paths', err);
      }
    }

    hasLoadedPathsRef.current = true;
  }, [project]);

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.eraseMode(editorState.activeTool === 'eraser');
  }, [editorState.activeTool]);

  const persistCanvas = useCallback(async () => {
    if (!project || !canvasRef.current) return;

    const paths = await canvasRef.current.exportPaths();
    const newConfig = {
      ...(project.config ?? {}),
      canvasPaths: paths ?? [],
      canvasSettings: {
        zoom: editorState.zoom,
        pan: editorState.pan,
        activeTool: editorState.activeTool,
        activeLayerId: editorState.activeLayerId,
        layers: editorState.layers,
        brush: editorState.brush,
        eraser: editorState.eraser,
      },
    };

    const { error } = await supabase
      .from('projects')
      .update({
        config: newConfig,
        updated_at: new Date().toISOString(),
      })
      .eq('id', project.id);

    if (error) {
      console.error('Failed to persist canvas', error.message);
    }
  }, [editorState.activeLayerId, editorState.activeTool, editorState.brush, editorState.eraser, editorState.layers, editorState.pan, editorState.zoom, project]);

  const schedulePersist = useCallback(() => {
    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      persistCanvas();
    }, 800);
  }, [persistCanvas]);

  const handleStroke = useCallback(() => {
    schedulePersist();
  }, [schedulePersist]);

  useEffect(() => {
    schedulePersist();
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editorState.zoom, editorState.pan, editorState.brush, editorState.eraser, editorState.layers, editorState.activeLayerId, editorState.activeTool, schedulePersist]);

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      setEditorState((state) => {
        const nextZoom = Math.min(4, Math.max(0.2, state.zoom + delta));
        return { ...state, zoom: nextZoom };
      });
    }
  };

  const startPan = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isSpacePressed && editorState.activeTool !== 'move') {
      return;
    }
    event.preventDefault();
    setIsPanning(true);
    panStartRef.current = { x: event.clientX - editorState.pan.x, y: event.clientY - editorState.pan.y };
  };

  const updatePan = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStartRef.current) return;
    const newPan = { x: event.clientX - panStartRef.current.x, y: event.clientY - panStartRef.current.y };
    setEditorState((state) => ({ ...state, pan: newPan }));
  };

  const stopPan = () => {
    setIsPanning(false);
    panStartRef.current = null;
  };

  const startSelection = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (editorState.activeTool !== 'select' || isSpacePressed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const startX = (event.clientX - rect.left - editorState.pan.x) / editorState.zoom;
    const startY = (event.clientY - rect.top - editorState.pan.y) / editorState.zoom;
    selectionStartRef.current = { x: startX, y: startY };
    setSelection({ x: startX, y: startY, width: 0, height: 0 });
  };

  const updateSelection = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!selectionStartRef.current || editorState.activeTool !== 'select' || isSpacePressed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const currentX = (event.clientX - rect.left - editorState.pan.x) / editorState.zoom;
    const currentY = (event.clientY - rect.top - editorState.pan.y) / editorState.zoom;
    const width = currentX - selectionStartRef.current.x;
    const height = currentY - selectionStartRef.current.y;
    setSelection({
      x: selectionStartRef.current.x,
      y: selectionStartRef.current.y,
      width,
      height,
    });
  };

  const stopSelection = () => {
    selectionStartRef.current = null;
  };

  const handleToolbarToolChange = (tool: EditorTool) => {
    setEditorState((state) => ({ ...state, activeTool: tool }));
  };

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput = target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (isInput) return;

      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setIsSpacePressed(true);
        previousToolRef.current = editorState.activeTool;
        setEditorState((state) => ({ ...state, activeTool: 'move' }));
      }

      if (event.key.toLowerCase() === 'v') {
        handleToolbarToolChange('move');
      } else if (event.key.toLowerCase() === 'b') {
        handleToolbarToolChange('brush');
      } else if (event.key.toLowerCase() === 'e') {
        handleToolbarToolChange('eraser');
      } else if (event.key.toLowerCase() === 'm') {
        handleToolbarToolChange('select');
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        setEditorState((state) => ({ ...state, zoom: Math.min(4, state.zoom + 0.1) }));
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '-') {
        event.preventDefault();
        setEditorState((state) => ({ ...state, zoom: Math.max(0.2, state.zoom - 0.1) }));
      }
    },
    [editorState.activeTool],
  );

  const handleKeyup = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space') {
      setIsSpacePressed(false);
      if (previousToolRef.current) {
        setEditorState((state) => ({ ...state, activeTool: previousToolRef.current as EditorTool }));
        previousToolRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('keyup', handleKeyup);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('keyup', handleKeyup);
    };
  }, [handleKeydown, handleKeyup]);

  const undo = () => canvasRef.current?.undo();
  const redo = () => canvasRef.current?.redo();
  const clear = () => {
    canvasRef.current?.clearCanvas();
    schedulePersist();
  };

  const exportImage = async () => {
    const image = await canvasRef.current?.exportImage('png');
    if (!image) return;
    const link = document.createElement('a');
    link.href = image;
    link.download = `${project.name}-canvas.png`;
    link.click();
  };

  const addLayer = () => {
    const newLayer: Layer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${editorState.layers.length + 1}`,
      visible: true,
      locked: false,
    };
    setEditorState((state) => ({ ...state, layers: [newLayer, ...state.layers], activeLayerId: newLayer.id }));
  };

  const deleteLayer = (layerId: string) => {
    if (editorState.layers.length === 1) return;
    const remaining = editorState.layers.filter((layer) => layer.id !== layerId);
    setEditorState((state) => ({
      ...state,
      layers: remaining,
      activeLayerId: remaining[0]?.id ?? state.activeLayerId,
    }));
  };

  const toggleVisibility = (layerId: string) => {
    setEditorState((state) => ({
      ...state,
      layers: state.layers.map((layer) => (layer.id === layerId ? { ...layer, visible: !layer.visible } : layer)),
    }));
  };

  const toggleLock = (layerId: string) => {
    setEditorState((state) => ({
      ...state,
      layers: state.layers.map((layer) => (layer.id === layerId ? { ...layer, locked: !layer.locked } : layer)),
    }));
  };

  const handleLayerDragStart = (event: DragEvent<HTMLButtonElement>, layerId: string) => {
    dragLayerIdRef.current = layerId;
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleLayerDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = dragLayerIdRef.current;
    if (!sourceId || sourceId === targetId) return;

    const updated = [...editorState.layers];
    const sourceIndex = updated.findIndex((layer) => layer.id === sourceId);
    const targetIndex = updated.findIndex((layer) => layer.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setEditorState((state) => ({ ...state, layers: updated }));
  };

  const handleLayerDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="canvas-workspace">
      <aside className="canvas-toolbar" aria-label="Canvas tools">
        <div className="canvas-toolbar__group">
          <button
            className={`canvas-tool ${editorState.activeTool === 'move' ? 'canvas-tool--active' : ''}`}
            onClick={() => handleToolbarToolChange('move')}
            title="Move (V)"
            type="button"
          >
            ☐
          </button>
          <button
            className={`canvas-tool ${editorState.activeTool === 'brush' ? 'canvas-tool--active' : ''}`}
            onClick={() => handleToolbarToolChange('brush')}
            title="Brush (B)"
            type="button"
          >
            🖌
          </button>
          <button
            className={`canvas-tool ${editorState.activeTool === 'eraser' ? 'canvas-tool--active' : ''}`}
            onClick={() => handleToolbarToolChange('eraser')}
            title="Eraser (E)"
            type="button"
          >
            ⌫
          </button>
          <button
            className={`canvas-tool ${editorState.activeTool === 'select' ? 'canvas-tool--active' : ''}`}
            onClick={() => handleToolbarToolChange('select')}
            title="Select (M)"
            type="button"
          >
            ▭
          </button>
        </div>

        <div className="canvas-toolbar__group">
          <button className="canvas-tool" onClick={() => setEditorState((s) => ({ ...s, zoom: Math.max(0.2, s.zoom - 0.1) }))} type="button">
            −
          </button>
          <button className="canvas-tool" onClick={() => setEditorState((s) => ({ ...s, zoom: Math.min(4, s.zoom + 0.1) }))} type="button">
            +
          </button>
        </div>

        <div className="canvas-toolbar__group">
          <button className="canvas-tool" onClick={undo} type="button">
            ↶
          </button>
          <button className="canvas-tool" onClick={redo} type="button">
            ↷
          </button>
          <button className="canvas-tool" onClick={clear} type="button">
            ⌦
          </button>
          <button className="canvas-tool" onClick={exportImage} type="button">
            ⤓
          </button>
        </div>
      </aside>

      <section className="canvas-center" onWheel={handleWheel}>
        <div
          className={`canvas-viewport ${isPanning ? 'canvas-viewport--panning' : ''}`}
          onMouseDown={(e) => {
            startPan(e);
            startSelection(e);
          }}
          onMouseMove={(e) => {
            updatePan(e);
            updateSelection(e);
          }}
          onMouseUp={() => {
            stopPan();
            stopSelection();
          }}
          onMouseLeave={() => {
            stopPan();
            stopSelection();
          }}
        >
          <div
            className="canvas-stage"
            style={{ transform: `translate3d(${editorState.pan.x}px, ${editorState.pan.y}px, 0) scale(${editorState.zoom})` }}
          >
            <div className="canvas-stage__surface">
              <ReactSketchCanvas
                ref={canvasRef}
                style={{
                  width: '100%',
                  height: '100%',
                  pointerEvents: editorState.activeTool === 'brush' || editorState.activeTool === 'eraser' ? 'auto' : 'none',
                }}
                strokeColor={editorState.brush.color}
                strokeWidth={editorState.brush.width}
                eraserWidth={editorState.eraser.width}
                canvasColor="transparent"
                onStroke={handleStroke}
              />
              {selectionRect && (
                <div
                  className="canvas-selection"
                  style={{
                    left: `${selectionRect.left}px`,
                    top: `${selectionRect.top}px`,
                    width: `${selectionRect.width}px`,
                    height: `${selectionRect.height}px`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <div className="canvas-status">
          <p>Zoom: {(editorState.zoom * 100).toFixed(0)}%</p>
          <p>Pan: {Math.round(editorState.pan.x)}, {Math.round(editorState.pan.y)}</p>
          <p>Tool: {editorState.activeTool}</p>
        </div>
      </section>

      <aside className="canvas-sidepanel">
        <div className="canvas-panel">
          <div className="canvas-panel__header">
            <h3>Layers</h3>
            <div className="canvas-panel__actions">
              <button className="button button--ghost" onClick={addLayer} type="button">
                Add
              </button>
            </div>
          </div>
          <div className="canvas-layers">
            {editorState.layers.map((layer) => (
              <div
                key={layer.id}
                className={`canvas-layer ${editorState.activeLayerId === layer.id ? 'canvas-layer--active' : ''}`}
                onClick={() => setEditorState((state) => ({ ...state, activeLayerId: layer.id }))}
                onDragOver={handleLayerDragOver}
                onDrop={(event) => handleLayerDrop(event, layer.id)}
              >
                <div className="canvas-layer__main">
                  <button
                    className="canvas-layer__drag"
                    draggable
                    onDragStart={(event) => handleLayerDragStart(event, layer.id)}
                    type="button"
                  >
                    ☰
                  </button>
                  <div className="canvas-layer__meta">
                    <p className="canvas-layer__name">{layer.name}</p>
                    <div className="canvas-layer__toggles">
                      <button
                        className={`canvas-layer__icon ${layer.visible ? '' : 'canvas-layer__icon--muted'}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleVisibility(layer.id);
                        }}
                        type="button"
                        aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                      >
                        👁
                      </button>
                      <button
                        className={`canvas-layer__icon ${layer.locked ? 'canvas-layer__icon--muted' : ''}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleLock(layer.id);
                        }}
                        type="button"
                        aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                      >
                        🔒
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  className="canvas-layer__delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteLayer(layer.id);
                  }}
                  type="button"
                  disabled={editorState.layers.length === 1}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="canvas-panel">
          <div className="canvas-panel__header">
            <h3>Properties</h3>
          </div>
          {editorState.activeTool === 'brush' && (
            <div className="canvas-props">
              <label className="form-label" htmlFor="brush-color">
                Stroke Color
              </label>
              <input
                id="brush-color"
                type="color"
                value={editorState.brush.color}
                onChange={(event) => setEditorState((state) => ({ ...state, brush: { ...state.brush, color: event.target.value } }))}
              />

              <label className="form-label" htmlFor="brush-width">
                Stroke Width ({editorState.brush.width}px)
              </label>
              <input
                id="brush-width"
                type="range"
                min={1}
                max={64}
                value={editorState.brush.width}
                onChange={(event) =>
                  setEditorState((state) => ({ ...state, brush: { ...state.brush, width: Number(event.target.value) } }))
                }
              />
            </div>
          )}

          {editorState.activeTool === 'eraser' && (
            <div className="canvas-props">
              <label className="form-label" htmlFor="eraser-width">
                Eraser Width ({editorState.eraser.width}px)
              </label>
              <input
                id="eraser-width"
                type="range"
                min={8}
                max={128}
                value={editorState.eraser.width}
                onChange={(event) =>
                  setEditorState((state) => ({ ...state, eraser: { ...state.eraser, width: Number(event.target.value) } }))
                }
              />
            </div>
          )}

          {editorState.activeTool === 'move' && (
            <div className="canvas-props">
              <p className="muted">Move tool active. Hold space to pan.</p>
            </div>
          )}

          {editorState.activeTool === 'select' && (
            <div className="canvas-props">
              <p className="muted">Selection size:</p>
              <p>
                {selection
                  ? `${Math.abs(Math.round(selection.width))} × ${Math.abs(Math.round(selection.height))} px`
                  : 'No selection'}
              </p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export default CanvasWorkspace;

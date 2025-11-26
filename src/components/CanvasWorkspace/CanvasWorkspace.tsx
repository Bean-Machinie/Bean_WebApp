import {
  MouseEvent as ReactMouseEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { supabase } from '../../lib/supabaseClient';
import type { Project } from '../../types/project';
import {
  CanvasConfig,
  CanvasLayer,
  CanvasStroke,
  StrokeData,
} from '../../types/canvas';
import * as canvasService from '../../services/canvasService';

export type EditorTool = 'move' | 'brush' | 'eraser' | 'select';

export type SelectionBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CanvasWorkspaceProps = {
  project: Project;
};

type DrawingState = {
  isDrawing: boolean;
  currentPath: Array<{ x: number; y: number; pressure?: number }>;
};

function CanvasWorkspace({ project }: CanvasWorkspaceProps) {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());

  const [config, setConfig] = useState<CanvasConfig | null>(null);
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [layerStrokes, setLayerStrokes] = useState<Map<string, CanvasStroke[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentPath: [],
  });

  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const [selection, setSelection] = useState<SelectionBox | null>(null);
  const previousToolRef = useRef<EditorTool | null>(null);
  const dragLayerIdRef = useRef<string | null>(null);
  const strokeOrderRef = useRef<number>(0);

  const [editorState, setEditorState] = useState({
    zoom: 1,
    pan: { x: 0, y: 0 },
    activeTool: 'brush' as EditorTool,
    activeLayerId: null as string | null,
    brush: { color: '#ffffff', width: 6 },
    eraser: { width: 24 },
  });

  // =============================================
  // INITIALIZATION & DATA LOADING
  // =============================================

  useEffect(() => {
    async function initializeCanvas() {
      try {
        setLoading(true);

        // Check if canvas config exists
        const existsConfig = await canvasService.canvasConfigExists(project.id);

        if (!existsConfig) {
          // Initialize new canvas for this project
          const { config: newConfig, defaultLayer } = await canvasService.initializeCanvasForProject(project.id);
          setConfig(newConfig);
          setLayers([defaultLayer]);
          setEditorState(prev => ({
            ...prev,
            zoom: newConfig.zoom,
            pan: { x: newConfig.pan_x, y: newConfig.pan_y },
            activeLayerId: defaultLayer.id,
          }));
        } else {
          // Load existing canvas
          const canvasData = await canvasService.getCanvasConfigWithLayers(project.id);
          if (canvasData) {
            setConfig(canvasData);
            setLayers(canvasData.canvas_layers);
            setEditorState(prev => ({
              ...prev,
              zoom: canvasData.zoom,
              pan: { x: canvasData.pan_x, y: canvasData.pan_y },
              activeLayerId: canvasData.canvas_layers[0]?.id ?? null,
            }));

            // Load strokes for all layers
            await loadAllLayerStrokes(canvasData.canvas_layers);
          }
        }
      } catch (error) {
        console.error('Failed to initialize canvas:', error);
      } finally {
        setLoading(false);
      }
    }

    initializeCanvas();
  }, [project.id]);

  const loadAllLayerStrokes = async (layersToLoad: CanvasLayer[]) => {
    const strokesMap = new Map<string, CanvasStroke[]>();

    for (const layer of layersToLoad) {
      try {
        const { strokes } = await canvasService.getStrokesByLayer(layer.id, { limit: 1000 });
        strokesMap.set(layer.id, strokes);

        // Update stroke order ref to highest value
        if (strokes.length > 0) {
          const maxOrder = Math.max(...strokes.map(s => s.stroke_order));
          if (maxOrder >= strokeOrderRef.current) {
            strokeOrderRef.current = maxOrder + 1;
          }
        }
      } catch (error) {
        console.error(`Failed to load strokes for layer ${layer.id}:`, error);
        strokesMap.set(layer.id, []);
      }
    }

    setLayerStrokes(strokesMap);
  };

  // =============================================
  // CANVAS RENDERING
  // =============================================

  useEffect(() => {
    if (!config || layers.length === 0) return;

    renderAllLayers();
  }, [config, layers, layerStrokes, editorState.zoom, editorState.pan]);

  const renderAllLayers = useCallback(() => {
    const mainCanvas = mainCanvasRef.current;
    if (!mainCanvas || !config) return;

    const ctx = mainCanvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    mainCanvas.width = config.width;
    mainCanvas.height = config.height;

    // Clear main canvas
    ctx.fillStyle = config.background_color;
    ctx.fillRect(0, 0, config.width, config.height);

    // Render each layer in order
    for (const layer of layers) {
      if (!layer.visible) continue;

      const strokes = layerStrokes.get(layer.id) ?? [];
      if (strokes.length === 0) continue;

      // Create or get layer canvas
      let layerCanvas = layerCanvasRefs.current.get(layer.id);
      if (!layerCanvas) {
        layerCanvas = document.createElement('canvas');
        layerCanvas.width = config.width;
        layerCanvas.height = config.height;
        layerCanvasRefs.current.set(layer.id, layerCanvas);
      }

      const layerCtx = layerCanvas.getContext('2d');
      if (!layerCtx) continue;

      // Clear layer canvas
      layerCtx.clearRect(0, 0, config.width, config.height);

      // Draw all strokes on this layer
      for (const stroke of strokes) {
        drawStroke(layerCtx, stroke.stroke_data);
      }

      // Composite layer onto main canvas with layer settings
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blend_mode as GlobalCompositeOperation;
      ctx.drawImage(layerCanvas, 0, 0);
      ctx.restore();
    }
  }, [config, layers, layerStrokes]);

  const drawStroke = (ctx: CanvasRenderingContext2D, strokeData: StrokeData) => {
    const { points, color, width, tool, opacity = 1 } = strokeData;

    if (points.length === 0) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = opacity;

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
    }

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      ctx.lineTo(point.x, point.y);
    }

    ctx.stroke();
    ctx.restore();
  };

  // =============================================
  // DRAWING INTERACTION
  // =============================================

  const startDrawing = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (editorState.activeTool !== 'brush' && editorState.activeTool !== 'eraser') return;
    if (!editorState.activeLayerId) return;

    const activeLayer = layers.find(l => l.id === editorState.activeLayerId);
    if (!activeLayer || activeLayer.locked) return;

    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - editorState.pan.x) / editorState.zoom;
    const y = (event.clientY - rect.top - editorState.pan.y) / editorState.zoom;

    setDrawingState({
      isDrawing: true,
      currentPath: [{ x, y }],
    });
  };

  const continueDrawing = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!drawingState.isDrawing) return;

    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - editorState.pan.x) / editorState.zoom;
    const y = (event.clientY - rect.top - editorState.pan.y) / editorState.zoom;

    setDrawingState(prev => ({
      ...prev,
      currentPath: [...prev.currentPath, { x, y }],
    }));

    // Draw preview on main canvas
    renderAllLayers();
    const ctx = mainCanvasRef.current?.getContext('2d');
    if (ctx) {
      const strokeData: StrokeData = {
        points: [...drawingState.currentPath, { x, y }],
        color: editorState.brush.color,
        width: editorState.activeTool === 'brush' ? editorState.brush.width : editorState.eraser.width,
        tool: editorState.activeTool,
      };
      drawStroke(ctx, strokeData);
    }
  };

  const finishDrawing = async () => {
    if (!drawingState.isDrawing || drawingState.currentPath.length < 2) {
      setDrawingState({ isDrawing: false, currentPath: [] });
      return;
    }

    if (!editorState.activeLayerId) return;

    try {
      const strokeData: StrokeData = {
        points: drawingState.currentPath,
        color: editorState.brush.color,
        width: editorState.activeTool === 'brush' ? editorState.brush.width : editorState.eraser.width,
        tool: editorState.activeTool,
      };

      // Save stroke to database
      const newStroke = await canvasService.createStroke({
        layer_id: editorState.activeLayerId,
        stroke_data: strokeData,
        stroke_order: strokeOrderRef.current++,
      });

      // Update local state
      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        const currentStrokes = newMap.get(editorState.activeLayerId!) ?? [];
        newMap.set(editorState.activeLayerId!, [...currentStrokes, newStroke]);
        return newMap;
      });

      // TODO: Create version snapshot for undo

    } catch (error) {
      console.error('Failed to save stroke:', error);
    } finally {
      setDrawingState({ isDrawing: false, currentPath: [] });
    }
  };

  // =============================================
  // PAN & ZOOM
  // =============================================

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

  // =============================================
  // KEYBOARD SHORTCUTS
  // =============================================

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
        setEditorState((state) => ({ ...state, activeTool: 'move' }));
      } else if (event.key.toLowerCase() === 'b') {
        setEditorState((state) => ({ ...state, activeTool: 'brush' }));
      } else if (event.key.toLowerCase() === 'e') {
        setEditorState((state) => ({ ...state, activeTool: 'eraser' }));
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

  // =============================================
  // LAYER OPERATIONS
  // =============================================

  const addLayer = async () => {
    if (!config) return;

    try {
      const newLayer = await canvasService.createLayer({
        canvas_config_id: config.id,
        name: `Layer ${layers.length + 1}`,
        order_index: layers.length,
      });

      setLayers(prev => [...prev, newLayer]);
      setEditorState(state => ({ ...state, activeLayerId: newLayer.id }));
      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        newMap.set(newLayer.id, []);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to add layer:', error);
    }
  };

  const deleteLayer = async (layerId: string) => {
    if (layers.length === 1) return;

    try {
      await canvasService.deleteLayer(layerId);

      const remaining = layers.filter((layer) => layer.id !== layerId);
      setLayers(remaining);

      if (editorState.activeLayerId === layerId) {
        setEditorState((state) => ({
          ...state,
          activeLayerId: remaining[0]?.id ?? null,
        }));
      }

      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        newMap.delete(layerId);
        return newMap;
      });

      layerCanvasRefs.current.delete(layerId);
    } catch (error) {
      console.error('Failed to delete layer:', error);
    }
  };

  const toggleVisibility = async (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    try {
      await canvasService.updateLayer(layerId, { visible: !layer.visible });

      setLayers(prev =>
        prev.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l))
      );
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
    }
  };

  const toggleLock = async (layerId: string) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;

    try {
      await canvasService.updateLayer(layerId, { locked: !layer.locked });

      setLayers(prev =>
        prev.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l))
      );
    } catch (error) {
      console.error('Failed to toggle lock:', error);
    }
  };

  // =============================================
  // UTILITIES
  // =============================================

  const clear = async () => {
    if (!editorState.activeLayerId) return;

    try {
      await canvasService.deleteStrokesByLayer(editorState.activeLayerId);

      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        newMap.set(editorState.activeLayerId!, []);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to clear layer:', error);
    }
  };

  const exportImage = () => {
    const canvas = mainCanvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name}-canvas.png`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  if (loading) {
    return <div className="canvas-workspace"><p>Loading canvas...</p></div>;
  }

  return (
    <div className="canvas-workspace">
      <aside className="canvas-toolbar" aria-label="Canvas tools">
        <div className="canvas-toolbar__group">
          <button
            className={`canvas-tool ${editorState.activeTool === 'move' ? 'canvas-tool--active' : ''}`}
            onClick={() => setEditorState(s => ({ ...s, activeTool: 'move' }))}
            title="Move (V)"
            type="button"
          >
            ☐
          </button>
          <button
            className={`canvas-tool ${editorState.activeTool === 'brush' ? 'canvas-tool--active' : ''}`}
            onClick={() => setEditorState(s => ({ ...s, activeTool: 'brush' }))}
            title="Brush (B)"
            type="button"
          >
            🖌
          </button>
          <button
            className={`canvas-tool ${editorState.activeTool === 'eraser' ? 'canvas-tool--active' : ''}`}
            onClick={() => setEditorState(s => ({ ...s, activeTool: 'eraser' }))}
            title="Eraser (E)"
            type="button"
          >
            ⌫
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
          onMouseDown={startPan}
          onMouseMove={updatePan}
          onMouseUp={stopPan}
          onMouseLeave={stopPan}
        >
          <div
            className="canvas-stage"
            style={{ transform: `translate3d(${editorState.pan.x}px, ${editorState.pan.y}px, 0) scale(${editorState.zoom})` }}
          >
            <div className="canvas-stage__surface">
              <canvas
                ref={mainCanvasRef}
                style={{
                  width: '100%',
                  height: '100%',
                  cursor: editorState.activeTool === 'move' || isSpacePressed ? 'grab' : 'crosshair',
                }}
                onMouseDown={startDrawing}
                onMouseMove={continueDrawing}
                onMouseUp={finishDrawing}
                onMouseLeave={finishDrawing}
              />
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
            {layers.map((layer) => (
              <div
                key={layer.id}
                className={`canvas-layer ${editorState.activeLayerId === layer.id ? 'canvas-layer--active' : ''}`}
                onClick={() => setEditorState((state) => ({ ...state, activeLayerId: layer.id }))}
              >
                <div className="canvas-layer__main">
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
                  disabled={layers.length === 1}
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
        </div>
      </aside>
    </div>
  );
}

export default CanvasWorkspace;

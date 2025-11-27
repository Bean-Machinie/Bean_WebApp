import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Stage, Layer, Line } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
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

type Point = { x: number; y: number; pressure?: number };

type DrawingState = {
  isDrawing: boolean;
  currentPath: Point[];
};

function CanvasWorkspace({ project }: CanvasWorkspaceProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentLineRef = useRef<Konva.Line | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const currentPathRef = useRef<Point[]>([]);
  const isDrawingRef = useRef<boolean>(false);

  const [config, setConfig] = useState<CanvasConfig | null>(null);
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [layerStrokes, setLayerStrokes] = useState<Map<string, CanvasStroke[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [drawingState, setDrawingState] = useState<DrawingState>({
    isDrawing: false,
    currentPath: [],
  });

  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const previousToolRef = useRef<EditorTool | null>(null);
  const strokeOrderRef = useRef<number>(0);

  // Initialize pan to center the canvas
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
  // STAGE RESIZE & INITIAL CENTERING
  // =============================================

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = containerRef.current.offsetHeight;
        setStageSize({ width, height });

        // Center the canvas on first load if pan is at 0,0
        if (config && editorState.pan.x === 0 && editorState.pan.y === 0) {
          const centerX = (width - config.width) / 2;
          const centerY = (height - config.height) / 2;
          setEditorState(prev => ({
            ...prev,
            pan: { x: centerX, y: centerY },
          }));
        }
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateSize);
    return () => {
      window.removeEventListener('resize', updateSize);
      observer.disconnect();
    };
  }, [config]);

  // =============================================
  // HELPER: Convert points to Konva Line format
  // =============================================

  const pointsToArray = (points: Point[]): number[] => {
    const arr: number[] = [];
    for (const point of points) {
      arr.push(point.x, point.y);
    }
    return arr;
  };

  // =============================================
  // HELPER: Interpolate points for smooth lines
  // =============================================

  const interpolatePoints = (p1: Point, p2: Point): Point[] => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Add intermediate points for distances > 2 pixels
    if (distance <= 2) {
      return [p2];
    }

    const steps = Math.ceil(distance / 2);
    const interpolated: Point[] = [];

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      interpolated.push({
        x: p1.x + dx * t,
        y: p1.y + dy * t,
        pressure: p2.pressure,
      });
    }

    return interpolated;
  };

  // =============================================
  // DRAWING INTERACTION - OPTIMIZED
  // =============================================

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent | PointerEvent>) => {
    if (editorState.activeTool !== 'brush' && editorState.activeTool !== 'eraser') return;
    if (!editorState.activeLayerId) return;

    const activeLayer = layers.find(l => l.id === editorState.activeLayerId);
    if (!activeLayer || activeLayer.locked) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Convert to canvas coordinates (accounting for zoom/pan)
    const transform = stage.getAbsoluteTransform().copy().invert();
    const canvasPos = transform.point(pos);

    // Get pressure from pointer event if available
    const pointerEvent = e.evt as PointerEvent;
    const pressure = pointerEvent.pressure ?? 0.5;

    const initialPoint = { x: canvasPos.x, y: canvasPos.y, pressure };

    lastPointRef.current = initialPoint;
    currentPathRef.current = [initialPoint];
    isDrawingRef.current = true;

    setDrawingState({
      isDrawing: true,
      currentPath: [initialPoint],
    });

    // Immediately render the initial point as a dot
    if (currentLineRef.current) {
      const dotPath = [
        initialPoint,
        { x: initialPoint.x + 0.1, y: initialPoint.y + 0.1, pressure: initialPoint.pressure }
      ];
      currentLineRef.current.points(pointsToArray(dotPath));
      currentLineRef.current.getLayer()?.batchDraw();
    }
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent | PointerEvent>) => {
    if (!isDrawingRef.current) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const transform = stage.getAbsoluteTransform().copy().invert();
    const canvasPos = transform.point(pos);

    // Get pressure from pointer event if available
    const pointerEvent = e.evt as PointerEvent;
    const pressure = pointerEvent.pressure ?? 0.5;

    const newPoint = { x: canvasPos.x, y: canvasPos.y, pressure };

    // Interpolate points for smooth lines
    let pointsToAdd: Point[] = [newPoint];
    if (lastPointRef.current) {
      pointsToAdd = interpolatePoints(lastPointRef.current, newPoint);
    }

    lastPointRef.current = newPoint;

    // Add points to ref (no re-render)
    currentPathRef.current = [...currentPathRef.current, ...pointsToAdd];

    // Force immediate render of current line
    if (currentLineRef.current) {
      currentLineRef.current.points(pointsToArray(currentPathRef.current));
      currentLineRef.current.getLayer()?.batchDraw();
    }
  };

  const handleStageMouseUp = async () => {
    if (!isDrawingRef.current || currentPathRef.current.length < 1) {
      isDrawingRef.current = false;
      currentPathRef.current = [];
      setDrawingState({ isDrawing: false, currentPath: [] });
      lastPointRef.current = null;
      return;
    }

    if (!editorState.activeLayerId) return;

    // Capture the final path immediately
    const finalPath = [...currentPathRef.current];

    // For single-click dots, duplicate the point to create a visible stroke
    if (finalPath.length === 1) {
      const singlePoint = finalPath[0];
      finalPath.push({
        x: singlePoint.x + 0.1,
        y: singlePoint.y + 0.1,
        pressure: singlePoint.pressure
      });
    }

    // Stop accepting new points immediately
    isDrawingRef.current = false;

    const strokeData: StrokeData = {
      points: finalPath,
      color: editorState.brush.color,
      width: editorState.activeTool === 'brush' ? editorState.brush.width : editorState.eraser.width,
      tool: editorState.activeTool === 'eraser' ? 'eraser' : 'brush',
    };

    // Create optimistic stroke with temporary ID
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const optimisticStroke: CanvasStroke = {
      id: tempId,
      layer_id: editorState.activeLayerId,
      stroke_data: strokeData,
      stroke_order: strokeOrderRef.current++,
      created_at: new Date().toISOString(),
    };

    // Immediately add optimistic stroke to UI (no flash!)
    const currentLayerId = editorState.activeLayerId;
    setLayerStrokes(prev => {
      const newMap = new Map(prev);
      const currentStrokes = newMap.get(currentLayerId) ?? [];
      newMap.set(currentLayerId, [...currentStrokes, optimisticStroke]);
      return newMap;
    });

    // Clear drawing state immediately since we have the optimistic stroke
    currentPathRef.current = [];
    setDrawingState({ isDrawing: false, currentPath: [] });
    lastPointRef.current = null;

    // Save to database in background and replace temp ID with real ID
    try {
      const newStroke = await canvasService.createStroke({
        layer_id: currentLayerId,
        stroke_data: strokeData,
        stroke_order: optimisticStroke.stroke_order,
      });

      // Replace optimistic stroke with real stroke from database
      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        const currentStrokes = newMap.get(currentLayerId) ?? [];
        const updatedStrokes = currentStrokes.map(s =>
          s.id === tempId ? newStroke : s
        );
        newMap.set(currentLayerId, updatedStrokes);
        return newMap;
      });

    } catch (error) {
      console.error('Failed to save stroke:', error);
      // Remove optimistic stroke on error
      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        const currentStrokes = newMap.get(currentLayerId) ?? [];
        newMap.set(currentLayerId, currentStrokes.filter(s => s.id !== tempId));
        return newMap;
      });
    }
  };


  // =============================================
  // PAN & ZOOM
  // =============================================

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.max(0.2, Math.min(4, oldScale + direction * 0.1));

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };

    setEditorState(prev => ({
      ...prev,
      zoom: newScale,
      pan: newPos,
    }));
  };

  const handleStageDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const stage = e.target;
    setEditorState(prev => ({
      ...prev,
      pan: { x: stage.x(), y: stage.y() },
    }));
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
    const stage = stageRef.current;
    if (!stage) return;

    const uri = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement('a');
    link.download = `${project.name}-canvas.png`;
    link.href = uri;
    link.click();
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

      <section className="canvas-center">
        <div
          ref={containerRef}
          className="canvas-viewport"
          style={{ width: '100%', height: '100%' }}
        >
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            scaleX={editorState.zoom}
            scaleY={editorState.zoom}
            x={editorState.pan.x}
            y={editorState.pan.y}
            draggable={editorState.activeTool === 'move' || isSpacePressed}
            onWheel={handleWheel}
            onDragEnd={handleStageDragEnd}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            onMouseLeave={handleStageMouseUp}
            onPointerDown={handleStageMouseDown}
            onPointerMove={handleStageMouseMove}
            onPointerUp={handleStageMouseUp}
            onPointerCancel={handleStageMouseUp}
            onPointerLeave={handleStageMouseUp}
            style={{
              cursor: editorState.activeTool === 'move' || isSpacePressed ? 'grab' : 'crosshair',
            }}
          >
            {/* Background layer */}
            <Layer listening={false}>
              <Line
                points={[0, 0, config?.width ?? 1920, 0, config?.width ?? 1920, config?.height ?? 1080, 0, config?.height ?? 1080]}
                closed
                fill={config?.background_color ?? '#0f172a'}
              />
            </Layer>

            {/* Render each canvas layer */}
            {layers.map((layer) => {
              if (!layer.visible) return null;

              const strokes = layerStrokes.get(layer.id) ?? [];

              return (
                <Layer
                  key={layer.id}
                  opacity={layer.opacity}
                  listening={!layer.locked}
                  globalCompositeOperation={layer.blend_mode as GlobalCompositeOperation}
                >
                  {strokes.map((stroke) => {
                    const { points, color, width, tool, opacity = 1 } = stroke.stroke_data;
                    const pointsArray = pointsToArray(points);

                    return (
                      <Line
                        key={stroke.id}
                        points={pointsArray}
                        stroke={color}
                        strokeWidth={width}
                        tension={0.5}
                        lineCap="round"
                        lineJoin="round"
                        opacity={opacity}
                        globalCompositeOperation={tool === 'eraser' ? 'destination-out' : 'source-over'}
                        perfectDrawEnabled={false}
                        shadowForStrokeEnabled={false}
                        hitStrokeWidth={0}
                      />
                    );
                  })}
                </Layer>
              );
            })}

            {/* Current drawing preview - optimized for performance */}
            {drawingState.isDrawing && (
              <Layer listening={false}>
                <Line
                  ref={currentLineRef}
                  points={[]}
                  stroke={editorState.brush.color}
                  strokeWidth={editorState.activeTool === 'brush' ? editorState.brush.width : editorState.eraser.width}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={editorState.activeTool === 'eraser' ? 'destination-out' : 'source-over'}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                  hitStrokeWidth={0}
                  listening={false}
                />
              </Layer>
            )}
          </Stage>
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

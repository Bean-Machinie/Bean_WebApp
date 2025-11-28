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
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

type Line = {
  tool: 'brush' | 'eraser';
  points: number[]; // flat array [x1, y1, x2, y2, ...]
  color: string;
  width: number;
};

// Sortable Layer Card Component
function SortableLayerCard({
  layer,
  isActive,
  onSelect,
  onToggleVisibility,
  onRename,
}: {
  layer: CanvasLayer;
  isActive: boolean;
  onSelect: () => void;
  onToggleVisibility: (e: React.MouseEvent) => void;
  onRename: (newName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(layer.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: layer.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue.trim() && editValue !== layer.name) {
      onRename(editValue.trim());
    } else {
      setEditValue(layer.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(layer.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`canvas-layer ${isActive ? 'canvas-layer--active' : ''}`}
      onClick={onSelect}
    >
      <div className="canvas-layer__content">
        <button
          className={`canvas-layer__eye ${layer.visible ? '' : 'canvas-layer__eye--hidden'}`}
          onClick={onToggleVisibility}
          type="button"
          aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
        >
          {layer.visible ? '👁' : '👁‍🗨'}
        </button>

        <div className="canvas-layer__preview">
          {/* Preview square - will be implemented later with actual layer thumbnail */}
          <div className="canvas-layer__preview-inner" />
        </div>

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="canvas-layer__name-input"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="canvas-layer__name"
            onDoubleClick={handleDoubleClick}
          >
            {layer.name}
          </span>
        )}
      </div>

      <div
        {...attributes}
        {...listeners}
        className="canvas-layer__drag-handle"
        title="Drag to reorder"
      >
        ⋮⋮
      </div>
    </div>
  );
}

function CanvasWorkspace({ project }: CanvasWorkspaceProps) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  const [config, setConfig] = useState<CanvasConfig | null>(null);
  const [layers, setLayers] = useState<CanvasLayer[]>([]);
  const [layerStrokes, setLayerStrokes] = useState<Map<string, CanvasStroke[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Simple drawing state EXACTLY like the example
  const [lines, setLines] = useState<Line[]>([]);

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

  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    })
  );

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
          // Extract background color from project config if available
          const bgColor = project.config?.backgroundColor as string | undefined;
          const { config: newConfig, defaultLayer } = await canvasService.initializeCanvasForProject(project.id, bgColor);

          // Load both the base layer and Layer 1
          const allLayers = await canvasService.getLayersByCanvasConfig(newConfig.id);

          setConfig(newConfig);
          setLayers(allLayers);
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
  // DRAWING INTERACTION - EXACTLY LIKE THE EXAMPLE
  // =============================================

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent | PointerEvent | TouchEvent>) => {
    // Only handle brush/eraser tool events
    if (editorState.activeTool !== 'brush' && editorState.activeTool !== 'eraser') return;
    if (!editorState.activeLayerId) return;

    // Prevent default behaviors to avoid interference with drawing
    // Only do this for drawing tools, not for panning
    if (e.evt.type.startsWith('touch') || e.evt.type.startsWith('pointer')) {
      e.evt.preventDefault();
    }

    const activeLayer = layers.find(l => l.id === editorState.activeLayerId);
    if (!activeLayer || activeLayer.locked) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Convert to canvas coordinates (accounting for zoom/pan)
    const transform = stage.getAbsoluteTransform().copy().invert();
    const canvasPos = transform.point(pos);

    isDrawingRef.current = true;

    // EXACTLY like the example - just add a new line to state
    setLines([...lines, {
      tool: editorState.activeTool === 'eraser' ? 'eraser' : 'brush',
      points: [canvasPos.x, canvasPos.y],
      color: editorState.brush.color,
      width: editorState.activeTool === 'brush' ? editorState.brush.width : editorState.eraser.width,
    }]);
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent | PointerEvent | TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const point = stage.getPointerPosition();
    if (!point) return;

    // Update cursor position using direct DOM manipulation for performance
    // Only for mouse/pointer events (not touch, as touch doesn't need cursor)
    if (cursorRef.current && e.evt.type !== 'touchmove') {
      const clientX = 'clientX' in e.evt ? e.evt.clientX : 0;
      const clientY = 'clientY' in e.evt ? e.evt.clientY : 0;

      cursorRef.current.style.left = `${clientX}px`;
      cursorRef.current.style.top = `${clientY}px`;

      // Make sure cursor is visible when moving with brush/eraser
      if ((editorState.activeTool === 'brush' || editorState.activeTool === 'eraser') && !isSpacePressed) {
        cursorRef.current.style.display = 'block';
      }
    }

    // no drawing - skipping
    if (!isDrawingRef.current) {
      return;
    }

    // Prevent default behaviors ONLY when actively drawing
    if (e.evt.type.startsWith('touch') || e.evt.type.startsWith('pointer')) {
      e.evt.preventDefault();
    }

    // Convert to canvas coordinates (accounting for zoom/pan)
    const transform = stage.getAbsoluteTransform().copy().invert();
    const canvasPos = transform.point(point);

    let lastLine = lines[lines.length - 1];
    if (!lastLine) return;

    // add point - EXACTLY like the example
    lastLine.points = lastLine.points.concat([canvasPos.x, canvasPos.y]);

    // replace last - EXACTLY like the example
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleStageMouseLeave = () => {
    if (cursorRef.current) {
      cursorRef.current.style.display = 'none';
    }
  };

  const handleStageMouseEnter = () => {
    if (cursorRef.current && (editorState.activeTool === 'brush' || editorState.activeTool === 'eraser') && !isSpacePressed) {
      cursorRef.current.style.display = 'block';
    }
  };

  const handleStageMouseUp = async () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;

    // Save the completed line to database in the background
    if (!editorState.activeLayerId || lines.length === 0) return;

    const completedLine = lines[lines.length - 1];

    // Convert flat points array to Point objects for database
    const pointObjects: Point[] = [];
    for (let i = 0; i < completedLine.points.length; i += 2) {
      pointObjects.push({
        x: completedLine.points[i],
        y: completedLine.points[i + 1],
      });
    }

    const strokeData: StrokeData = {
      points: pointObjects,
      color: completedLine.color,
      width: completedLine.width,
      tool: completedLine.tool,
    };

    const currentLayerId = editorState.activeLayerId;

    // Save to database in background
    try {
      const newStroke = await canvasService.createStroke({
        layer_id: currentLayerId,
        stroke_data: strokeData,
        stroke_order: strokeOrderRef.current++,
      });

      // Add to layerStrokes for persistence
      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        const currentStrokes = newMap.get(currentLayerId) ?? [];
        newMap.set(currentLayerId, [...currentStrokes, newStroke]);
        return newMap;
      });

      // Clear temporary lines after save
      setLines([]);
    } catch (error) {
      console.error('Failed to save stroke:', error);
      setLines([]);
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

  const handleStageDragStart = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handleStageDragEnd = (e: KonvaEventObject<DragEvent>) => {
    isDraggingRef.current = false;
    setIsDragging(false);
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

      // Space bar for temporary pan
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();

        setEditorState((state) => {
          // Only store previous tool if we're not already panning
          if (state.activeTool !== 'move') {
            previousToolRef.current = state.activeTool;
          }
          return { ...state, activeTool: 'move' };
        });

        setIsSpacePressed(true);
        return;
      }

      // Tool shortcuts - only when Space is not pressed
      if (!event.repeat) {
        if (event.key.toLowerCase() === 'v') {
          setEditorState((state) => ({ ...state, activeTool: 'move' }));
          previousToolRef.current = null; // Clear previous tool when explicitly selecting move
        } else if (event.key.toLowerCase() === 'b') {
          setEditorState((state) => ({ ...state, activeTool: 'brush' }));
          previousToolRef.current = null;
        } else if (event.key.toLowerCase() === 'e') {
          setEditorState((state) => ({ ...state, activeTool: 'eraser' }));
          previousToolRef.current = null;
        }
      }

      // Zoom shortcuts
      if ((event.ctrlKey || event.metaKey) && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        setEditorState((state) => ({ ...state, zoom: Math.min(4, state.zoom + 0.1) }));
      }

      if ((event.ctrlKey || event.metaKey) && event.key === '-') {
        event.preventDefault();
        setEditorState((state) => ({ ...state, zoom: Math.max(0.2, state.zoom - 0.1) }));
      }
    },
    [],
  );

  const handleKeyup = useCallback((event: KeyboardEvent) => {
    if (event.code === 'Space') {
      event.preventDefault();
      setIsSpacePressed(false);

      // Restore previous tool if one was stored
      if (previousToolRef.current && previousToolRef.current !== 'move') {
        const toolToRestore = previousToolRef.current;
        setEditorState((state) => ({ ...state, activeTool: toolToRestore }));
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

  // Update cursor visibility and size when tool, size, or space state changes
  useEffect(() => {
    if (cursorRef.current) {
      const shouldShow = (editorState.activeTool === 'brush' || editorState.activeTool === 'eraser') && !isSpacePressed;
      cursorRef.current.style.display = shouldShow ? 'block' : 'none';

      // Update cursor size
      const size = editorState.activeTool === 'brush' ? editorState.brush.width : editorState.eraser.width;
      const scaledSize = size * editorState.zoom;
      cursorRef.current.style.width = `${scaledSize}px`;
      cursorRef.current.style.height = `${scaledSize}px`;
    }
  }, [editorState.activeTool, editorState.brush.width, editorState.eraser.width, editorState.zoom, isSpacePressed]);

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

  const addFolderLayer = async () => {
    if (!config) return;

    try {
      const newLayer = await canvasService.createLayer({
        canvas_config_id: config.id,
        name: `Folder ${layers.filter(l => l.name.startsWith('Folder')).length + 1}`,
        order_index: layers.length,
      });

      setLayers(prev => [...prev, newLayer]);
      setLayerStrokes(prev => {
        const newMap = new Map(prev);
        newMap.set(newLayer.id, []);
        return newMap;
      });
    } catch (error) {
      console.error('Failed to add folder layer:', error);
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

  // Note: Delete and Lock layer functionality are kept in canvasService
  // but not exposed in the UI as per requirements

  const renameLayer = async (layerId: string, newName: string) => {
    try {
      await canvasService.updateLayer(layerId, { name: newName });

      setLayers(prev =>
        prev.map((l) => (l.id === layerId ? { ...l, name: newName } : l))
      );
    } catch (error) {
      console.error('Failed to rename layer:', error);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = layers.findIndex((l) => l.id === active.id);
    const newIndex = layers.findIndex((l) => l.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder layers locally
    const reorderedLayers = arrayMove(layers, oldIndex, newIndex);
    setLayers(reorderedLayers);

    // Update order_index for all layers in the database
    try {
      const updates = reorderedLayers.map((layer, index) => ({
        id: layer.id,
        order_index: index,
      }));
      await canvasService.reorderLayers(updates);
    } catch (error) {
      console.error('Failed to reorder layers:', error);
      // Revert on error
      setLayers(layers);
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

      // Also clear temporary lines
      setLines([]);
      isDrawingRef.current = false;
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
            onDragStart={handleStageDragStart}
            onDragEnd={handleStageDragEnd}
            onPointerDown={handleStageMouseDown}
            onPointerMove={handleStageMouseMove}
            onPointerUp={handleStageMouseUp}
            onPointerCancel={handleStageMouseUp}
            onPointerEnter={handleStageMouseEnter}
            onPointerLeave={() => {
              handleStageMouseLeave();
              handleStageMouseUp();
            }}
            onTouchStart={handleStageMouseDown}
            onTouchMove={handleStageMouseMove}
            onTouchEnd={handleStageMouseUp}
            style={{
              cursor: (editorState.activeTool === 'move' || isSpacePressed)
                ? (isDragging ? 'grabbing' : 'grab')
                : (editorState.activeTool === 'brush' || editorState.activeTool === 'eraser')
                  ? 'none'
                  : 'crosshair',
              touchAction: 'none',
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
                  {/* Render persisted strokes from database */}
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

                  {/* Render temporary lines being drawn - EXACTLY like the example */}
                  {layer.id === editorState.activeLayerId && lines.map((line, i) => (
                    <Line
                      key={i}
                      points={line.points}
                      stroke={line.color}
                      strokeWidth={line.width}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={line.tool === 'eraser' ? 'destination-out' : 'source-over'}
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                      hitStrokeWidth={0}
                    />
                  ))}
                </Layer>
              );
            })}
          </Stage>

          {/* Custom circular cursor for brush/eraser */}
          <div
            ref={cursorRef}
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              border: '1px solid rgba(255, 255, 255, 0.8)',
              borderRadius: '50%',
              pointerEvents: 'none',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              display: 'none',
            }}
          />
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

        <div className="canvas-panel canvas-panel--layers">
          <div className="canvas-panel__header">
            <h3>Layers</h3>
          </div>
          <div className="canvas-layers">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={layers.map(l => l.id)}
                strategy={verticalListSortingStrategy}
              >
                {layers.map((layer) => (
                  <SortableLayerCard
                    key={layer.id}
                    layer={layer}
                    isActive={editorState.activeLayerId === layer.id}
                    onSelect={() => setEditorState((state) => ({ ...state, activeLayerId: layer.id }))}
                    onToggleVisibility={(e) => {
                      e.stopPropagation();
                      toggleVisibility(layer.id);
                    }}
                    onRename={(newName) => renameLayer(layer.id, newName)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="canvas-layer-actions">
            <button
              className="canvas-layer-action"
              onClick={addLayer}
              type="button"
              title="Add new layer"
            >
              <span className="canvas-layer-action__icon">+</span>
              <span className="canvas-layer-action__label">New Layer</span>
            </button>
            <button
              className="canvas-layer-action canvas-layer-action--disabled"
              type="button"
              title="Import image (coming soon)"
              disabled
            >
              <span className="canvas-layer-action__icon">🖼</span>
              <span className="canvas-layer-action__label">Import Image</span>
            </button>
            <button
              className="canvas-layer-action"
              onClick={addFolderLayer}
              type="button"
              title="Add folder layer"
            >
              <span className="canvas-layer-action__icon">📁</span>
              <span className="canvas-layer-action__label">Folder</span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default CanvasWorkspace;

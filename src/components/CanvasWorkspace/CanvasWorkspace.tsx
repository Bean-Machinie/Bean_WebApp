import React from 'react';
import { Stage, Layer as KonvaLayer, Line, Circle } from 'react-konva';
import type { Project } from '@/types/project';
import type { Stroke, Layer, ShapeType } from '@/types/canvas';
import { saveCanvas, loadCanvas } from '@/services/canvasService';
import { generateClientId } from '@/lib/utils';
import LayerPanel from '@/components/LayerPanel/LayerPanel';
import ToolSelectionPanel from '@/components/ToolSelectionPanel/ToolSelectionPanel';
import PenToolConfig from '@/components/PenToolConfig/PenToolConfig';
import EraserToolConfig from '@/components/EraserToolConfig/EraserToolConfig';
import ShapeToolConfig from '@/components/ShapeToolConfig/ShapeToolConfig';
import './CanvasWorkspace.css';

type CanvasWorkspaceProps = {
  project: Project;
};

function CanvasWorkspace({ project }: CanvasWorkspaceProps) {
  // Canvas configuration from project
  const canvasConfig = project.config as { width?: number; height?: number; backgroundColor?: string } | undefined;
  const canvasWidth = canvasConfig?.width || 1000;
  const canvasHeight = canvasConfig?.height || 1000;
  const canvasBackgroundColor = canvasConfig?.backgroundColor || '#ffffff';

  const [tool, setTool] = React.useState<'pen' | 'eraser' | 'shape'>('pen');
  const [layers, setLayers] = React.useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = React.useState<string>('');
  const [brushSize, setBrushSize] = React.useState(5);
  const [brushColor, setBrushColor] = React.useState('#df4b26');
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Shape tool state
  const [selectedShape, setSelectedShape] = React.useState<ShapeType>('rectangle');
  const [fillEnabled, setFillEnabled] = React.useState(false);
  const [fillColor, setFillColor] = React.useState('#ffffff');

  // History for undo/redo
  const [history, setHistory] = React.useState<Layer[][]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const isApplyingHistory = React.useRef(false);

  // Zoom & Pan state
  const [scale, setScale] = React.useState(1);
  // Calculate initial position to center the canvas in the viewport
  // Left: Tool Selection (60px) + Tool Config (220px) = 280px
  // Right: Sidebar (200px)
  const viewportWidth = window.innerWidth - 480;
  const viewportHeight = window.innerHeight;
  const initialX = (viewportWidth - canvasWidth) / 2;
  const initialY = (viewportHeight - canvasHeight) / 2;
  const [position, setPosition] = React.useState({ x: initialX, y: initialY });

  // Cursor overlay state
  const [cursorPos, setCursorPos] = React.useState<{ x: number; y: number } | null>(null);
  const [showCursor, setShowCursor] = React.useState(true);

  // Interaction refs
  const isDrawing = React.useRef(false);
  const isPanning = React.useRef(false);
  const lastPanPoint = React.useRef<{ x: number; y: number } | null>(null);
  const stageRef = React.useRef<any>(null);
  const layerRef = React.useRef<any>(null);
  const isSpacePressed = React.useRef(false);

  // Transform pointer position from screen to canvas coordinates
  const getTransformedPointerPosition = (stage: any) => {
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return null;

    // Transform from screen space to canvas space
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointerPos);
  };

  // Push current state to history (for undo/redo)
  const pushToHistory = React.useCallback((newLayers: Layer[]) => {
    if (isApplyingHistory.current) return;

    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(JSON.parse(JSON.stringify(newLayers)));
      if (newHistory.length > 30) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1 >= 30 ? 29 : prev + 1);
  }, [historyIndex]);

  // Undo function
  const undo = React.useCallback(() => {
    if (historyIndex > 0) {
      isApplyingHistory.current = true;
      const previousState = history[historyIndex - 1];
      setLayers(JSON.parse(JSON.stringify(previousState)));
      setHistoryIndex(prev => prev - 1);
      setTimeout(() => {
        isApplyingHistory.current = false;
      }, 0);
    }
  }, [history, historyIndex]);

  // Redo function
  const redo = React.useCallback(() => {
    if (historyIndex < history.length - 1) {
      isApplyingHistory.current = true;
      const nextState = history[historyIndex + 1];
      setLayers(JSON.parse(JSON.stringify(nextState)));
      setHistoryIndex(prev => prev + 1);
      setTimeout(() => {
        isApplyingHistory.current = false;
      }, 0);
    }
  }, [history, historyIndex]);

  // Handle mouse wheel zoom
  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const stage = e.target.getStage();
    const oldScale = scale;
    const pointer = stage.getPointerPosition();

    // Calculate new scale
    const scaleBy = 1.1;
    const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;

    // Clamp scale between 0.1x and 10x
    const clampedScale = Math.max(0.1, Math.min(10, newScale));

    // Calculate new position to zoom towards cursor
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };

    const newPos = {
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    };

    setScale(clampedScale);
    setPosition(newPos);
  };

  // Handle mouse down - start drawing or panning
  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();

    // Check if we should pan (middle mouse OR left click while space held)
    const isMiddleMouse = e.evt.button === 1;
    const isLeftClickWithSpace = e.evt.button === 0 && isSpacePressed.current;
    const shouldPan = isMiddleMouse || isLeftClickWithSpace;

    if (shouldPan) {
      e.evt.preventDefault();
      // CRITICAL: Stop any drawing immediately
      isDrawing.current = false;
      // Start panning
      isPanning.current = true;
      const pos = stage.getPointerPosition();
      lastPanPoint.current = pos;
      setShowCursor(false);
      stage.container().style.cursor = 'grabbing';
    } else if (e.evt.button === 0) {
      // Only draw on left click (button 0) when NOT panning
      isPanning.current = false;
      isDrawing.current = true;
      const transformedPos = getTransformedPointerPosition(stage);
      if (transformedPos && activeLayerId) {
        // Add new stroke to the active layer
        const newStroke: Stroke = {
          clientId: generateClientId(),
          tool,
          points: [transformedPos.x, transformedPos.y],
          color: brushColor,
          strokeWidth: brushSize,
          // Shape-specific properties
          ...(tool === 'shape' && {
            shapeType: selectedShape,
            fillColor: fillEnabled ? fillColor : undefined,
          }),
        };

        setLayers(prev => prev.map(layer =>
          layer.id === activeLayerId
            ? { ...layer, strokes: [...layer.strokes, newStroke] }
            : layer
        ));
      }
    }
  };

  // Handle mouse move - draw or pan
  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Update cursor position for overlay
    if (pointer) {
      setCursorPos(pointer);
    }

    if (isPanning.current && lastPanPoint.current && pointer) {
      // Pan the canvas - calculate delta
      const deltaX = pointer.x - lastPanPoint.current.x;
      const deltaY = pointer.y - lastPanPoint.current.y;

      setPosition((prevPosition) => ({
        x: prevPosition.x + deltaX,
        y: prevPosition.y + deltaY,
      }));
      lastPanPoint.current = pointer;
    } else if (isDrawing.current && activeLayerId) {
      // Continue drawing - immutable update to active layer's last stroke
      const transformedPoint = getTransformedPointerPosition(stage);
      if (transformedPoint) {
        setLayers(prev => prev.map(layer => {
          if (layer.id !== activeLayerId) return layer;

          const updatedStrokes = [...layer.strokes];
          const lastIndex = updatedStrokes.length - 1;
          if (lastIndex >= 0) {
            const currentStroke = updatedStrokes[lastIndex];
            // For shapes, only keep start and end points
            if (currentStroke.tool === 'shape') {
              const startX = currentStroke.points[0];
              const startY = currentStroke.points[1];
              updatedStrokes[lastIndex] = {
                ...currentStroke,
                points: [startX, startY, transformedPoint.x, transformedPoint.y]
              };
            } else {
              // For pen/eraser, keep adding points
              updatedStrokes[lastIndex] = {
                ...currentStroke,
                points: [...currentStroke.points, transformedPoint.x, transformedPoint.y]
              };
            }
          }
          return { ...layer, strokes: updatedStrokes };
        }));
      }
    }
  };

  // Handle mouse up - stop drawing or panning
  const handleMouseUp = () => {
    // If we were drawing, record the state in history
    if (isDrawing.current && activeLayerId) {
      pushToHistory(layers);
    }

    // Reset drawing state
    isDrawing.current = false;
    isPanning.current = false;
    lastPanPoint.current = null;
    setShowCursor(true);

    if (stageRef.current) {
      // If space is still held, show grab cursor, otherwise none
      if (isSpacePressed.current) {
        stageRef.current.container().style.cursor = 'grab';
      } else {
        stageRef.current.container().style.cursor = 'none';
      }
    }
  };

  // Handle mouse enter/leave for cursor visibility
  const handleMouseEnter = () => {
    setShowCursor(true);
  };

  const handleMouseLeave = () => {
    setShowCursor(false);
    setCursorPos(null);
  };

  // Load canvas when project opens
  React.useEffect(() => {
    const loadProjectCanvas = async () => {
      console.log('Loading canvas for project:', project.id);
      const { layers: loadedLayers, activeLayerId: loadedActiveLayerId } = await loadCanvas(project.id);
      console.log('Loaded', loadedLayers.length, 'layers from database');
      setLayers(loadedLayers);
      setActiveLayerId(loadedActiveLayerId);
      setLastSaved(new Date());

      // Initialize history with the loaded state
      setHistory([JSON.parse(JSON.stringify(loadedLayers))]);
      setHistoryIndex(0);
    };

    loadProjectCanvas();
  }, [project.id]);

  // Initialize default layer if empty
  React.useEffect(() => {
    if (layers.length === 0 && !lastSaved) {
      const defaultLayer: Layer = {
        id: generateClientId(),
        name: 'Layer 1',
        visible: true,
        order: 0,
        strokes: [],
      };
      setLayers([defaultLayer]);
      setActiveLayerId(defaultLayer.id);

      // Initialize history with the default layer
      setHistory([[JSON.parse(JSON.stringify(defaultLayer))]]);
      setHistoryIndex(0);
    }
  }, [layers.length, lastSaved]);

  // Debounced auto-save - saves 2 seconds after last change
  React.useEffect(() => {
    // Don't save if no layers or still loading
    if (layers.length === 0 && !lastSaved) return;

    const timeoutId = setTimeout(async () => {
      try {
        setIsSaving(true);
        setSaveError(null);
        const totalStrokes = layers.reduce((sum, layer) => sum + layer.strokes.length, 0);
        console.log('Attempting to save canvas with', layers.length, 'layers and', totalStrokes, 'strokes');
        await saveCanvas(project.id, layers, activeLayerId);
        setLastSaved(new Date());
        console.log('Canvas saved successfully');
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveError(error instanceof Error ? error.message : 'Save failed');
      } finally {
        setIsSaving(false);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [layers, activeLayerId, project.id]);

  // Optimize canvas for frequent getImageData calls (for eraser tool)
  React.useEffect(() => {
    if (stageRef.current && layerRef.current) {
      const canvas = layerRef.current.getCanvas()._canvas;
      // Set willReadFrequently hint for better eraser performance
      canvas.getContext('2d', { willReadFrequently: true });

      // Force re-render with optimized context
      layerRef.current.batchDraw();
    }
  }, []);

  // Keyboard support for spacebar panning and undo/redo
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z (or Cmd+Y / Cmd+Shift+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
        return;
      }

      if (e.code === 'Space' && !isSpacePressed.current) {
        e.preventDefault();
        isSpacePressed.current = true;
        if (stageRef.current && !isPanning.current) {
          stageRef.current.container().style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        isSpacePressed.current = false;
        if (stageRef.current && !isPanning.current) {
          stageRef.current.container().style.cursor = 'none';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [undo, redo]);

  // Helper component to render shapes
  const renderShape = (stroke: Stroke) => {
    if (stroke.tool !== 'shape' || !stroke.shapeType || stroke.points.length < 4) {
      return null;
    }

    const [x1, y1, x2, y2] = stroke.points;
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    const commonProps = {
      key: stroke.clientId,
      stroke: stroke.color,
      strokeWidth: stroke.strokeWidth,
      fill: stroke.fillColor || 'transparent',
      listening: false,
      perfectDrawEnabled: false,
      shadowForStrokeEnabled: false,
    };

    switch (stroke.shapeType) {
      case 'line':
        return (
          <Line
            {...commonProps}
            points={[x1, y1, x2, y2]}
            lineCap="round"
          />
        );

      case 'rectangle':
        return (
          <Line
            {...commonProps}
            points={[minX, minY, minX + width, minY, minX + width, minY + height, minX, minY + height]}
            closed
          />
        );

      case 'ellipse':
        return (
          <Line
            {...commonProps}
            points={generateEllipsePoints(minX + width / 2, minY + height / 2, width / 2, height / 2)}
            closed
            tension={0}
          />
        );

      case 'triangle':
        // Equilateral triangle pointing up
        const centerX = minX + width / 2;
        const topY = minY;
        const bottomY = minY + height;
        return (
          <Line
            {...commonProps}
            points={[centerX, topY, minX + width, bottomY, minX, bottomY]}
            closed
          />
        );

      default:
        return null;
    }
  };

  // Generate ellipse points using parametric equation
  const generateEllipsePoints = (cx: number, cy: number, rx: number, ry: number): number[] => {
    const points: number[] = [];
    const steps = 64; // Number of points to approximate the ellipse
    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const x = cx + rx * Math.cos(angle);
      const y = cy + ry * Math.sin(angle);
      points.push(x, y);
    }
    return points;
  };

  return (
    <div className="canvas-workspace">
      {/* Tool Selection Panel */}
      <ToolSelectionPanel activeTool={tool} onToolChange={setTool} />

      {/* Tool Config Panel */}
      {tool === 'pen' ? (
        <PenToolConfig
          brushSize={brushSize}
          brushColor={brushColor}
          onBrushSizeChange={setBrushSize}
          onBrushColorChange={setBrushColor}
        />
      ) : tool === 'eraser' ? (
        <EraserToolConfig brushSize={brushSize} onBrushSizeChange={setBrushSize} />
      ) : (
        <ShapeToolConfig
          brushSize={brushSize}
          brushColor={brushColor}
          selectedShape={selectedShape}
          fillEnabled={fillEnabled}
          fillColor={fillColor}
          onBrushSizeChange={setBrushSize}
          onBrushColorChange={setBrushColor}
          onShapeChange={setSelectedShape}
          onFillEnabledChange={setFillEnabled}
          onFillColorChange={setFillColor}
        />
      )}

      {/* Center Canvas Area */}
      <div
        className="canvas-workspace__canvas-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Stage
          ref={stageRef}
          width={window.innerWidth - 480}
          height={window.innerHeight}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          scaleX={scale}
          scaleY={scale}
          x={position.x}
          y={position.y}
          style={{ cursor: 'none' }}
        >
          {/* Background Layer */}
          <KonvaLayer listening={false}>
            <Line
              points={[0, 0, canvasWidth, 0, canvasWidth, canvasHeight, 0, canvasHeight]}
              closed
              fill={canvasBackgroundColor}
              stroke={canvasBackgroundColor}
              strokeWidth={0}
              listening={false}
            />
          </KonvaLayer>

          {/* Render each canvas layer as a separate Konva layer for proper eraser isolation */}
          {layers
            .filter(layer => layer.visible)
            .sort((a, b) => a.order - b.order)
            .map(layer => (
              <KonvaLayer
                key={layer.id}
                ref={layer.id === activeLayerId ? layerRef : undefined}
                listening={false}
              >
                {layer.strokes.map((stroke) => {
                  // Render shapes differently from pen/eraser strokes
                  if (stroke.tool === 'shape') {
                    return renderShape(stroke);
                  }

                  // Render pen/eraser strokes as lines
                  return (
                    <Line
                      key={stroke.clientId}
                      points={stroke.points}
                      stroke={stroke.color}
                      strokeWidth={stroke.strokeWidth}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={
                        stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
                      }
                      perfectDrawEnabled={false}
                      shadowForStrokeEnabled={false}
                      hitStrokeWidth={0}
                      listening={false}
                    />
                  );
                })}
              </KonvaLayer>
            ))}

          {/* Cursor Overlay - Brush Preview Circle */}
          {showCursor && cursorPos && !isPanning.current && (
            <KonvaLayer listening={false}>
              {tool === 'shape' ? (
                // Crosshair cursor for shape tool
                <>
                  <Line
                    points={[
                      (cursorPos.x - position.x) / scale - 10 / scale,
                      (cursorPos.y - position.y) / scale,
                      (cursorPos.x - position.x) / scale + 10 / scale,
                      (cursorPos.y - position.y) / scale,
                    ]}
                    stroke={brushColor}
                    strokeWidth={1 / scale}
                    opacity={0.7}
                  />
                  <Line
                    points={[
                      (cursorPos.x - position.x) / scale,
                      (cursorPos.y - position.y) / scale - 10 / scale,
                      (cursorPos.x - position.x) / scale,
                      (cursorPos.y - position.y) / scale + 10 / scale,
                    ]}
                    stroke={brushColor}
                    strokeWidth={1 / scale}
                    opacity={0.7}
                  />
                </>
              ) : (
                // Circle cursor for pen/eraser tool
                <Circle
                  x={(cursorPos.x - position.x) / scale}
                  y={(cursorPos.y - position.y) / scale}
                  radius={brushSize / 2}
                  stroke={tool === 'eraser' ? '#ffffff' : brushColor}
                  strokeWidth={1 / scale}
                  opacity={0.5}
                  dash={[4 / scale, 4 / scale]}
                />
              )}
            </KonvaLayer>
          )}
        </Stage>
      </div>

      {/* Right Sidebar */}
      <div className="canvas-workspace__sidebar">
        <div className="canvas-workspace__sidebar-content">
          <h3 className="canvas-workspace__sidebar-title">Properties</h3>

          {/* Zoom Controls */}
          <div className="canvas-workspace__property-group">
            <label className="canvas-workspace__label">
              Zoom: {Math.round(scale * 100)}%
            </label>
            <button
              onClick={() => {
                setScale(1);
                const viewportWidth = window.innerWidth - 520; // 200px toolbar + 320px sidebar
                const viewportHeight = window.innerHeight;
                const centerX = (viewportWidth - canvasWidth) / 2;
                const centerY = (viewportHeight - canvasHeight) / 2;
                setPosition({ x: centerX, y: centerY });
              }}
              className="canvas-workspace__button"
            >
              Reset View
            </button>
            <div className="canvas-workspace__help-text">
              <p>• Scroll to zoom</p>
              <p>• Space + Drag to pan</p>
              <p>• Middle-click to pan</p>
            </div>
          </div>

          <div className="canvas-workspace__divider" />

          <div className="canvas-workspace__property-group">
            <label className="canvas-workspace__label">Canvas Info</label>
            <div className="canvas-workspace__info">
              <p>Layers: {layers.length}</p>
              <p>Total Strokes: {layers.reduce((sum, layer) => sum + layer.strokes.length, 0)}</p>
              <p>
                {isSaving ? '💾 Saving...' : saveError ? `❌ Error: ${saveError}` : lastSaved ? `✓ Saved ${lastSaved.toLocaleTimeString()}` : ''}
              </p>
            </div>
          </div>

          <div className="canvas-workspace__divider" />

          {/* Layer Panel Integration */}
          <LayerPanel
            layers={layers}
            activeLayerId={activeLayerId}
            onLayersChange={setLayers}
            onActiveLayerChange={setActiveLayerId}
          />
        </div>
      </div>
    </div>
  );
}

export default CanvasWorkspace;

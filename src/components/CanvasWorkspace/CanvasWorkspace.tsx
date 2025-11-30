import React from 'react';
import { Stage, Layer as KonvaLayer, Line, Circle } from 'react-konva';
import type { Project } from '@/types/project';
import type { Stroke, Layer } from '@/types/canvas';
import { saveCanvas, loadCanvas } from '@/services/canvasService';
import { generateClientId } from '@/lib/utils';
import LayerPanel from '@/components/LayerPanel/LayerPanel';
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

  const [tool, setTool] = React.useState<'pen' | 'eraser'>('pen');
  const [layers, setLayers] = React.useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = React.useState<string>('');
  const [brushSize, setBrushSize] = React.useState(5);
  const [brushColor, setBrushColor] = React.useState('#df4b26');
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  // Zoom & Pan state
  const [scale, setScale] = React.useState(1);
  // Calculate initial position to center the canvas in the viewport
  const viewportWidth = window.innerWidth - 400; // Subtract left toolbar (200px) + right sidebar (200px)
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
            updatedStrokes[lastIndex] = {
              ...updatedStrokes[lastIndex],
              points: [...updatedStrokes[lastIndex].points, transformedPoint.x, transformedPoint.y]
            };
          }
          return { ...layer, strokes: updatedStrokes };
        }));
      }
    }
  };

  // Handle mouse up - stop drawing or panning
  const handleMouseUp = () => {
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

  // Keyboard support for spacebar panning
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, []);

  return (
    <div className="canvas-workspace">
      {/* Left Toolbar */}
      <div className="canvas-workspace__toolbar">
        <div className="canvas-workspace__toolbar-content">
          <h3 className="canvas-workspace__toolbar-title">Tools</h3>

          {/* Tool Selection */}
          <div className="canvas-workspace__tool-group">
            <label className="canvas-workspace__label">Tool</label>
            <select
              value={tool}
              onChange={(e) => setTool(e.target.value as 'pen' | 'eraser')}
              className="canvas-workspace__tool-select"
            >
              <option value="pen">Pen</option>
              <option value="eraser">Eraser</option>
            </select>
          </div>

          <div className="canvas-workspace__divider" />

          {/* Brush Size Slider */}
          <div className="canvas-workspace__tool-group">
            <label className="canvas-workspace__label">
              Brush Size: {brushSize}px
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="canvas-workspace__slider"
            />
          </div>

          {/* Color Picker */}
          <div className="canvas-workspace__tool-group">
            <label className="canvas-workspace__label">Color</label>
            <div className="canvas-workspace__color-picker">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="canvas-workspace__color-input"
              />
              <input
                type="text"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="canvas-workspace__color-text"
                placeholder="#000000"
              />
            </div>
          </div>

          <div className="canvas-workspace__divider" />

          {/* Zoom Info */}
          <div className="canvas-workspace__tool-group">
            <label className="canvas-workspace__label">
              Zoom: {Math.round(scale * 100)}%
            </label>
            <button
              onClick={() => {
                setScale(1);
                // Reset to centered position
                const viewportWidth = window.innerWidth - 400;
                const viewportHeight = window.innerHeight;
                const centerX = (viewportWidth - canvasWidth) / 2;
                const centerY = (viewportHeight - canvasHeight) / 2;
                setPosition({ x: centerX, y: centerY });
              }}
              className="canvas-workspace__button"
            >
              Reset View
            </button>
          </div>

          <div className="canvas-workspace__help-text">
            <p>• Scroll to zoom</p>
            <p>• Space + Drag to pan</p>
            <p>• Middle-click to pan</p>
          </div>
        </div>
      </div>

      {/* Center Canvas Area */}
      <div
        className="canvas-workspace__canvas-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Stage
          ref={stageRef}
          width={window.innerWidth - 400}
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
          <KonvaLayer
            ref={layerRef}
            listening={false}
          >
            {/* Canvas Background Rectangle */}
            <Line
              points={[0, 0, canvasWidth, 0, canvasWidth, canvasHeight, 0, canvasHeight]}
              closed
              fill={canvasBackgroundColor}
              stroke={canvasBackgroundColor}
              strokeWidth={0}
              listening={false}
            />

            {/* Render layers in order (lowest order first, so higher order appears on top) */}
            {layers
              .filter(layer => layer.visible)
              .sort((a, b) => a.order - b.order)
              .map(layer => (
                <React.Fragment key={layer.id}>
                  {layer.strokes.map((stroke) => (
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
                  ))}
                </React.Fragment>
              ))}
          </KonvaLayer>

          {/* Cursor Overlay - Brush Preview Circle */}
          {showCursor && cursorPos && !isPanning.current && (
            <KonvaLayer listening={false}>
              <Circle
                x={(cursorPos.x - position.x) / scale}
                y={(cursorPos.y - position.y) / scale}
                radius={brushSize / 2}
                stroke={tool === 'eraser' ? '#ffffff' : brushColor}
                strokeWidth={1 / scale}
                opacity={0.5}
                dash={[4 / scale, 4 / scale]}
              />
            </KonvaLayer>
          )}
        </Stage>
      </div>

      {/* Right Sidebar */}
      <div className="canvas-workspace__sidebar">
        <div className="canvas-workspace__sidebar-content">
          <h3 className="canvas-workspace__sidebar-title">Properties</h3>

          <div className="canvas-workspace__property-group">
            <label className="canvas-workspace__label">Canvas Info</label>
            <div className="canvas-workspace__info">
              <p>Layers: {layers.length}</p>
              <p>Total Strokes: {layers.reduce((sum, layer) => sum + layer.strokes.length, 0)}</p>
              <p>Position: ({Math.round(position.x)}, {Math.round(position.y)})</p>
              <p>Scale: {scale.toFixed(2)}x</p>
              <p>
                {isSaving ? '💾 Saving...' : saveError ? `❌ Error: ${saveError}` : lastSaved ? `✓ Saved ${lastSaved.toLocaleTimeString()}` : ''}
              </p>
            </div>
          </div>

          <div className="canvas-workspace__divider" />

          <div className="canvas-workspace__property-group">
            <label className="canvas-workspace__label">Current Tool</label>
            <div className="canvas-workspace__info">
              <p>Type: {tool === 'pen' ? 'Pen' : 'Eraser'}</p>
              <p>Size: {brushSize}px</p>
              {tool === 'pen' && <p>Color: {brushColor}</p>}
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

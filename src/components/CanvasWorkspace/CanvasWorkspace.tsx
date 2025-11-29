import React from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import type { Project } from '@/types/project';
import type { Stroke } from '@/types/canvas';
import { saveStroke, loadStrokes } from '@/services/canvasService';
import './CanvasWorkspace.css';

type CanvasWorkspaceProps = {
  project: Project;
};

function CanvasWorkspace({ project }: CanvasWorkspaceProps) {
  const [tool, setTool] = React.useState<'pen' | 'eraser'>('pen');
  const [lines, setLines] = React.useState<Stroke[]>([]);
  const [brushSize, setBrushSize] = React.useState(5);
  const [brushColor, setBrushColor] = React.useState('#df4b26');

  // Zoom & Pan state
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  // Cursor overlay state
  const [cursorPos, setCursorPos] = React.useState<{ x: number; y: number } | null>(null);
  const [showCursor, setShowCursor] = React.useState(true);

  // Interaction refs
  const isDrawing = React.useRef(false);
  const isPanning = React.useRef(false);
  const lastPanPoint = React.useRef<{ x: number; y: number } | null>(null);
  const stageRef = React.useRef<any>(null);
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
      if (transformedPos) {
        setLines([...lines, {
          tool,
          points: [transformedPos.x, transformedPos.y],
          color: brushColor,
          strokeWidth: brushSize
        }]);
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
    } else if (isDrawing.current) {
      // Continue drawing
      const transformedPoint = getTransformedPointerPosition(stage);
      if (transformedPoint) {
        const lastLine = lines[lines.length - 1];
        lastLine.points = lastLine.points.concat([transformedPoint.x, transformedPoint.y]);
        lines.splice(lines.length - 1, 1, lastLine);
        setLines(lines.concat());
      }
    }
  };

  // Handle mouse up - stop drawing or panning
  const handleMouseUp = () => {
    // Save stroke asynchronously if we were drawing
    if (isDrawing.current && lines.length > 0) {
      const completedStroke = lines[lines.length - 1];

      // Save asynchronously - don't await (non-blocking)
      saveStroke(project.id, completedStroke).then(strokeId => {
        // Update stroke with DB ID (for future undo feature)
        setLines(prev => {
          const updated = [...prev];
          const idx = updated.findIndex(s => s === completedStroke);
          if (idx !== -1) {
            updated[idx] = { ...updated[idx], id: strokeId };
          }
          return updated;
        });
      }).catch(error => {
        console.error('Failed to save stroke:', error);
        // Could show toast notification to user in future
      });
    }

    // Reset drawing state immediately (non-blocking)
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

  // Load strokes when project opens
  React.useEffect(() => {
    const loadProjectStrokes = async () => {
      const loadedStrokes = await loadStrokes(project.id);
      setLines(loadedStrokes);  // Single state update - batch rendering
    };

    loadProjectStrokes();
  }, [project.id]);

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
                setPosition({ x: 0, y: 0 });
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
          <Layer>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.color}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>

          {/* Cursor Overlay - Brush Preview Circle */}
          {showCursor && cursorPos && !isPanning.current && (
            <Layer listening={false}>
              <Circle
                x={(cursorPos.x - position.x) / scale}
                y={(cursorPos.y - position.y) / scale}
                radius={brushSize / 2}
                stroke={tool === 'eraser' ? '#ffffff' : brushColor}
                strokeWidth={1 / scale}
                opacity={0.5}
                dash={[4 / scale, 4 / scale]}
              />
            </Layer>
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
              <p>Strokes: {lines.length}</p>
              <p>Position: ({Math.round(position.x)}, {Math.round(position.y)})</p>
              <p>Scale: {scale.toFixed(2)}x</p>
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

          <p className="canvas-workspace__sidebar-placeholder">
            Layer management coming in Phase 3
          </p>
        </div>
      </div>
    </div>
  );
}

export default CanvasWorkspace;

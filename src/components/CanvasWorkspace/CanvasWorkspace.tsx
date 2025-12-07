import React from 'react';
import { Stage, Layer as KonvaLayer, Line, Transformer, Rect, Ellipse } from 'react-konva';
import type { Project } from '@/types/project';
import type { Stroke, Layer, ShapeType, EditableShape } from '@/types/canvas';
import { saveCanvas, loadCanvas } from '@/services/canvasService';
import { generateClientId } from '@/lib/utils';
import LayerPanel from '@/components/LayerPanel/LayerPanel';
import ToolSelectionPanel from '@/components/ToolSelectionPanel/ToolSelectionPanel';
import PenToolConfig from '@/components/PenToolConfig/PenToolConfig';
import EraserToolConfig from '@/components/EraserToolConfig/EraserToolConfig';
import ShapeToolConfig from '@/components/ShapeToolConfig/ShapeToolConfig';
import { EditableShapeComponent } from './EditableShape';
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

  // Shape selection and editing
  const [selectedShapeId, setSelectedShapeId] = React.useState<string | null>(null);
  const transformerRef = React.useRef<any>(null);

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

  // Cursor overlay - use ref instead of state for performance
  const cursorRef = React.useRef<HTMLDivElement>(null);
  const [showCursor, setShowCursor] = React.useState(true);

  // Interaction refs
  const isDrawing = React.useRef(false);
  const isPanning = React.useRef(false);
  const lastPanPoint = React.useRef<{ x: number; y: number } | null>(null);
  const stageRef = React.useRef<any>(null);
  const layerRef = React.useRef<any>(null);
  const isSpacePressed = React.useRef(false);
  const gridRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Performance optimization refs
  const currentStrokeRef = React.useRef<Stroke | null>(null);
  const previewLineRef = React.useRef<any>(null);
  const cachedRectsRef = React.useRef<{ container?: DOMRect; stage?: DOMRect } | null>(null);

  // Modifier keys for shape creation and selection
  const modifierKeysRef = React.useRef({ shift: false, alt: false, ctrl: false });

  // Transform pointer position from screen to canvas coordinates
  const getTransformedPointerPosition = (stage: any) => {
    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return null;

    // Transform from screen space to canvas space
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointerPos);
  };

  // Convert EditableShape to permanent Stroke (bake shape)
  const bakeShapeToStroke = (shape: EditableShape): Stroke => {
    const { x, y, width, height, rotation, scaleX, scaleY, shapeType, strokeColor, strokeWidth, fillColor, fillEnabled } = shape;

    // Calculate actual dimensions with scale
    const actualWidth = width * scaleX;
    const actualHeight = height * scaleY;

    let points: number[] = [];

    // Generate points based on shape type
    if (shapeType === 'rectangle') {
      // Rectangle: 4 corners + back to start for closed shape
      const corners = [
        [x, y],
        [x + actualWidth, y],
        [x + actualWidth, y + actualHeight],
        [x, y + actualHeight],
        [x, y] // Close the shape
      ];

      // Apply rotation if needed
      if (rotation !== 0) {
        const centerX = x + actualWidth / 2;
        const centerY = y + actualHeight / 2;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        points = corners.flatMap(([px, py]) => {
          const dx = px - centerX;
          const dy = py - centerY;
          return [
            centerX + dx * cos - dy * sin,
            centerY + dx * sin + dy * cos
          ];
        });
      } else {
        points = corners.flat();
      }
    } else if (shapeType === 'ellipse') {
      // Ellipse: approximate with 36 points (10 degree increments)
      const centerX = x + actualWidth / 2;
      const centerY = y + actualHeight / 2;
      const radiusX = actualWidth / 2;
      const radiusY = actualHeight / 2;
      const numPoints = 36;

      const ellipsePoints: number[][] = [];
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        let px = centerX + radiusX * Math.cos(angle);
        let py = centerY + radiusY * Math.sin(angle);

        // Apply rotation if needed
        if (rotation !== 0) {
          const rad = (rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const dx = px - centerX;
          const dy = py - centerY;
          px = centerX + dx * cos - dy * sin;
          py = centerY + dx * sin + dy * cos;
        }

        ellipsePoints.push([px, py]);
      }
      points = ellipsePoints.flat();
    } else if (shapeType === 'triangle') {
      // Triangle: 3 corners + back to start
      const corners = [
        [x + actualWidth / 2, y],           // Top
        [x + actualWidth, y + actualHeight], // Bottom right
        [x, y + actualHeight],               // Bottom left
        [x + actualWidth / 2, y]             // Close
      ];

      // Apply rotation if needed
      if (rotation !== 0) {
        const centerX = x + actualWidth / 2;
        const centerY = y + actualHeight / 2;
        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        points = corners.flatMap(([px, py]) => {
          const dx = px - centerX;
          const dy = py - centerY;
          return [
            centerX + dx * cos - dy * sin,
            centerY + dx * sin + dy * cos
          ];
        });
      } else {
        points = corners.flat();
      }
    }

    return {
      clientId: generateClientId(),
      tool: 'shape',
      points,
      color: strokeColor,
      strokeWidth,
      shapeType,
      fillColor: fillEnabled ? fillColor : undefined,
      closed: true,
      saveState: 'saved'
    };
  };

  // Cache bounding rects for cursor positioning (performance optimization)
  const updateCachedRects = React.useCallback(() => {
    if (containerRef.current && stageRef.current) {
      cachedRectsRef.current = {
        container: containerRef.current.getBoundingClientRect(),
        stage: stageRef.current.container().getBoundingClientRect()
      };
    }
  }, []);

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

  // Shape management handlers
  const handleShapeChange = React.useCallback((shapeId: string, attrs: Partial<import('@/types/canvas').EditableShape>) => {
    setLayers(prev => {
      const newLayers = prev.map(layer => ({
        ...layer,
        shapes: layer.shapes?.map(shape =>
          shape.id === shapeId ? { ...shape, ...attrs } : shape
        ) || []
      }));
      pushToHistory(newLayers);
      return newLayers;
    });
  }, [pushToHistory]);

  const handleDeleteShape = React.useCallback((shapeId: string) => {
    setLayers(prev => {
      const newLayers = prev.map(layer => ({
        ...layer,
        shapes: layer.shapes?.filter(s => s.id !== shapeId) || []
      }));
      pushToHistory(newLayers);
      return newLayers;
    });
    setSelectedShapeId(null);
  }, [pushToHistory]);

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
      // Check if clicked on shape or transformer
      const clickedOnShape = e.target !== stage && e.target.attrs?.id;
      const clickedOnTransformer = e.target.getClassName() === 'Transformer' ||
                                   e.target.parent?.getClassName() === 'Transformer';

      // If clicked on transformer or selected shape, let Konva handle it (don't draw)
      if (clickedOnTransformer || (selectedShapeId && clickedOnShape && e.target.attrs?.id === selectedShapeId)) {
        return; // Don't start drawing when manipulating shapes
      }

      // Click outside selected shape: BAKE it to permanent stroke and deselect
      if (selectedShapeId) {
        setLayers(prev => {
          const newLayers = prev.map(layer => {
            // Find and bake the selected shape
            const shapeToBake = layer.shapes?.find(s => s.id === selectedShapeId);
            if (!shapeToBake) return layer;

            // Convert shape to stroke
            const bakedStroke = bakeShapeToStroke(shapeToBake);

            // Remove from shapes, add to strokes
            return {
              ...layer,
              shapes: layer.shapes?.filter(s => s.id !== selectedShapeId) || [],
              strokes: [...layer.strokes, bakedStroke]
            };
          });
          pushToHistory(newLayers);
          return newLayers;
        });
        setSelectedShapeId(null);
        return; // Don't start drawing on the same click that bakes the shape
      }

      // Only draw on left click (button 0) when NOT panning
      isPanning.current = false;
      isDrawing.current = true;
      const transformedPos = getTransformedPointerPosition(stage);
      if (transformedPos && activeLayerId && previewLineRef.current) {
        // Create stroke in ref (no state update = fast!)
        currentStrokeRef.current = {
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

        // Initialize preview line immediately
        previewLineRef.current.points([transformedPos.x, transformedPos.y]);
        previewLineRef.current.stroke(brushColor);
        previewLineRef.current.strokeWidth(brushSize);
        previewLineRef.current.globalCompositeOperation(
          tool === 'eraser' ? 'destination-out' : 'source-over'
        );
        previewLineRef.current.getLayer().batchDraw();
      }
    }
  };

  // Handle mouse move - draw or pan (ZERO state updates for max performance!)
  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Update cursor position directly via DOM (no re-render!)
    if (cursorRef.current && cachedRectsRef.current?.container && cachedRectsRef.current?.stage) {
      const { container, stage: stageRect } = cachedRectsRef.current;
      const x = pointer.x + (stageRect.left - container.left);
      const y = pointer.y + (stageRect.top - container.top);
      cursorRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }

    if (isPanning.current && lastPanPoint.current) {
      // Pan via direct Stage manipulation (no re-render!)
      const deltaX = pointer.x - lastPanPoint.current.x;
      const deltaY = pointer.y - lastPanPoint.current.y;

      const newX = stage.x() + deltaX;
      const newY = stage.y() + deltaY;
      stage.x(newX);
      stage.y(newY);
      stage.batchDraw();

      lastPanPoint.current = pointer;
    } else if (isDrawing.current && currentStrokeRef.current) {
      // Continue drawing - update ref and preview line directly (no state update!)
      const transformedPoint = getTransformedPointerPosition(stage);
      if (transformedPoint && previewLineRef.current) {
        const stroke = currentStrokeRef.current;

        // For shapes, only keep start and end points with modifier key logic
        if (stroke.tool === 'shape') {
          const startX = stroke.points[0];
          const startY = stroke.points[1];
          let endX = transformedPoint.x;
          let endY = transformedPoint.y;

          // Calculate dimensions
          let width = endX - startX;
          let height = endY - startY;

          // Shift: Constrain to square/circle
          if (modifierKeysRef.current.shift) {
            const size = Math.max(Math.abs(width), Math.abs(height));
            width = width < 0 ? -size : size;
            height = height < 0 ? -size : size;
            endX = startX + width;
            endY = startY + height;
          }

          // Alt: Draw from center
          if (modifierKeysRef.current.alt) {
            const centerX = startX;
            const centerY = startY;
            endX = centerX + width;
            endY = centerY + height;
            const newStartX = centerX - width;
            const newStartY = centerY - height;
            stroke.points = [newStartX, newStartY, endX, endY];
          } else {
            stroke.points = [startX, startY, endX, endY];
          }
        } else {
          // For pen/eraser, keep adding points
          stroke.points.push(transformedPoint.x, transformedPoint.y);

          // ERASER: Check if touching any shapes and delete them
          if (stroke.tool === 'eraser') {
            const eraserRadius = brushSize / 2;
            setLayers(prev => prev.map(layer => {
              if (layer.id !== activeLayerId) return layer;

              // Filter out shapes that are touched by eraser
              const shapesToKeep = (layer.shapes || []).filter(shape => {
                // Calculate shape bounds considering scale
                const shapeLeft = shape.x;
                const shapeTop = shape.y;
                const shapeRight = shape.x + (shape.width * shape.scaleX);
                const shapeBottom = shape.y + (shape.height * shape.scaleY);

                // Check if eraser point is within shape bounds (simple AABB collision)
                const isTouching = transformedPoint.x + eraserRadius > shapeLeft &&
                                   transformedPoint.x - eraserRadius < shapeRight &&
                                   transformedPoint.y + eraserRadius > shapeTop &&
                                   transformedPoint.y - eraserRadius < shapeBottom;

                return !isTouching; // Keep shape if NOT touching
              });

              return { ...layer, shapes: shapesToKeep };
            }));
          }
        }

        // Update preview shape based on shape type (fast!)
        const [x1, y1, x2, y2] = stroke.points;
        const minX = Math.min(x1, x2);
        const minY = Math.min(y1, y2);
        const absWidth = Math.abs(x2 - x1);
        const absHeight = Math.abs(y2 - y1);

        if (stroke.shapeType === 'rectangle') {
          // Update rectangle preview
          previewLineRef.current.x(minX);
          previewLineRef.current.y(minY);
          previewLineRef.current.width(absWidth);
          previewLineRef.current.height(absHeight);
        } else if (stroke.shapeType === 'ellipse') {
          // Update ellipse preview
          const centerX = minX + absWidth / 2;
          const centerY = minY + absHeight / 2;
          previewLineRef.current.x(centerX);
          previewLineRef.current.y(centerY);
          previewLineRef.current.radiusX(absWidth / 2);
          previewLineRef.current.radiusY(absHeight / 2);
        } else if (stroke.shapeType === 'triangle') {
          // Update triangle preview with three points
          const points = [
            minX + absWidth / 2, minY,           // Top
            minX + absWidth, minY + absHeight,   // Bottom right
            minX, minY + absHeight,              // Bottom left
          ];
          previewLineRef.current.points(points);
        } else {
          // Line or other: use points directly
          previewLineRef.current.points(stroke.points);
        }
        previewLineRef.current.getLayer().batchDraw();
      }
    }
  };

  // Handle mouse up - stop drawing or panning
  const handleMouseUp = () => {
    // If we were drawing, commit stroke or shape from ref to state (only 1 state update per stroke!)
    if (isDrawing.current && currentStrokeRef.current && activeLayerId) {
      const completedStroke = currentStrokeRef.current;
      let newShapeId: string | null = null;

      setLayers(prev => {
        const newLayers = prev.map(layer => {
          if (layer.id !== activeLayerId) return layer;

          // For shape tool, create EditableShape instead of stroke
          if (completedStroke.tool === 'shape' && completedStroke.shapeType &&
              completedStroke.shapeType !== 'line' && completedStroke.shapeType !== 'polyline') {
            const [x1, y1, x2, y2] = completedStroke.points;
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const width = Math.abs(x2 - x1);
            const height = Math.abs(y2 - y1);

            // Only create shape if it has meaningful size
            if (width > 2 && height > 2) {
              const shapeId = generateClientId();
              newShapeId = shapeId; // Capture ID for auto-selection

              const newShape: EditableShape = {
                id: shapeId,
                shapeType: completedStroke.shapeType as 'rectangle' | 'ellipse' | 'triangle',
                x,
                y,
                width,
                height,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                strokeColor: completedStroke.color,
                strokeWidth: completedStroke.strokeWidth,
                fillColor: completedStroke.fillColor,
                fillEnabled: !!completedStroke.fillColor,
              };

              return {
                ...layer,
                shapes: [...(layer.shapes || []), newShape]
              };
            }
            return layer;
          }

          // For other tools (pen, eraser, line), add as stroke
          return { ...layer, strokes: [...layer.strokes, completedStroke] };
        });

        // Push to history with new layers
        pushToHistory(newLayers);
        return newLayers;
      });

      // Auto-select the newly created shape
      if (newShapeId) {
        setSelectedShapeId(newShapeId);
      }

      // Clear current stroke ref and preview line
      currentStrokeRef.current = null;
      if (previewLineRef.current) {
        previewLineRef.current.points([]);
        previewLineRef.current.getLayer().batchDraw();
      }
    }

    // If we were panning, sync position state with Stage
    if (isPanning.current && stageRef.current) {
      setPosition({ x: stageRef.current.x(), y: stageRef.current.y() });
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

  // Update infinite grid background based on zoom and pan
  React.useEffect(() => {
    if (!gridRef.current) return;

    // Base grid size (spacing between lines at 100% zoom)
    const baseGridSize = 50;

    // Calculate grid size based on current scale
    // At higher zoom levels, we increase grid spacing to maintain visual density
    let gridSize = baseGridSize * scale;

    // Adaptive grid: switch to larger grid when zoomed out for better visibility
    if (scale < 0.5) {
      gridSize = baseGridSize * scale * 2;
    }

    // Calculate background position to keep grid aligned when panning
    // The modulo operation ensures the grid pattern repeats infinitely
    const offsetX = position.x % gridSize;
    const offsetY = position.y % gridSize;

    // Apply the grid background with calculated size and position
    gridRef.current.style.backgroundSize = `${gridSize}px ${gridSize}px`;
    gridRef.current.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
  }, [scale, position]);

  // Update cached rects when component mounts or scale/position changes
  React.useEffect(() => {
    updateCachedRects();
  }, [scale, position, updateCachedRects]);

  // Keyboard support for spacebar panning, undo/redo, and modifier keys
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

      // Delete selected shape
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedShapeId) {
        e.preventDefault();
        handleDeleteShape(selectedShapeId);
        return;
      }

      // Deselect with Escape
      if (e.key === 'Escape' && selectedShapeId) {
        e.preventDefault();
        setSelectedShapeId(null);
        return;
      }

      // Track modifier keys for shape creation and selection
      if (e.key === 'Shift') {
        modifierKeysRef.current.shift = true;
      }
      if (e.key === 'Alt') {
        modifierKeysRef.current.alt = true;
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        modifierKeysRef.current.ctrl = true;
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
      // Release modifier keys
      if (e.key === 'Shift') {
        modifierKeysRef.current.shift = false;
      }
      if (e.key === 'Alt') {
        modifierKeysRef.current.alt = false;
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        modifierKeysRef.current.ctrl = false;
      }

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
  }, [undo, redo, selectedShapeId]);

  // Attach Transformer to selected shape
  React.useEffect(() => {
    if (selectedShapeId && transformerRef.current && stageRef.current) {
      const selectedNode = stageRef.current.findOne(`#${selectedShapeId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();

        // Customize rotation handle cursor
        const transformer = transformerRef.current;
        const rotater = transformer.findOne('.rotater');

        if (rotater) {
          const stage = stageRef.current;

          // Hand cursor on hover
          rotater.on('mouseenter', () => {
            stage.container().style.cursor = 'grab';
          });

          rotater.on('mouseleave', () => {
            stage.container().style.cursor = 'none';
          });

          // Grabbing cursor when dragging
          rotater.on('mousedown', () => {
            stage.container().style.cursor = 'grabbing';
          });

          rotater.on('mouseup', () => {
            stage.container().style.cursor = 'grab';
          });
        }
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
    }
  }, [selectedShapeId]);

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
        ref={containerRef}
        className="canvas-workspace__canvas-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Infinite Grid Background */}
        <div ref={gridRef} className="canvas-workspace__grid-background" />

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
          style={{ cursor: 'none', position: 'relative', zIndex: 1 }}
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

                {/* Preview line on active layer for proper eraser visual feedback */}
                {layer.id === activeLayerId && (tool === 'pen' || tool === 'eraser' || (tool === 'shape' && selectedShape === 'line')) && (
                  <Line
                    ref={previewLineRef}
                    points={[]}
                    stroke={brushColor}
                    strokeWidth={brushSize}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={tool === 'eraser' ? 'destination-out' : 'source-over'}
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                    listening={false}
                  />
                )}
              </KonvaLayer>
            ))}

          {/* Editable Shapes Layer - NEW: Native Konva shapes with selection/transform */}
          <KonvaLayer name="shapesLayer" listening={true}>
            {layers
              .filter(layer => layer.visible)
              .sort((a, b) => a.order - b.order)
              .map(layer =>
                layer.shapes?.map(shape => (
                  <EditableShapeComponent
                    key={shape.id}
                    shape={shape}
                    isSelected={shape.id === selectedShapeId}
                    onSelect={() => setSelectedShapeId(shape.id)}
                    onChange={(attrs) => handleShapeChange(shape.id, attrs)}
                  />
                ))
              )}

            {/* Transformer for selected shape */}
            {selectedShapeId && (
              <Transformer
                ref={transformerRef}
                rotateEnabled={true}
                enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                boundBoxFunc={(oldBox, newBox) => {
                  // Minimum size constraint
                  if (newBox.width < 5 || newBox.height < 5) {
                    return oldBox;
                  }

                  // Shift key: constrain aspect ratio (proportional scaling)
                  if (modifierKeysRef.current.shift) {
                    const aspectRatio = oldBox.width / oldBox.height;

                    // Determine which dimension changed more
                    const widthChange = Math.abs(newBox.width - oldBox.width);
                    const heightChange = Math.abs(newBox.height - oldBox.height);

                    if (widthChange > heightChange) {
                      // Width changed more, adjust height to maintain ratio
                      newBox.height = newBox.width / aspectRatio;
                    } else {
                      // Height changed more, adjust width to maintain ratio
                      newBox.width = newBox.height * aspectRatio;
                    }
                  }

                  return newBox;
                }}
              />
            )}
          </KonvaLayer>

          {/* Preview Layer - for shape previews only (pen/eraser preview is on active layer) */}
          <KonvaLayer listening={false}>
            {/* Rectangle preview */}
            {tool === 'shape' && selectedShape === 'rectangle' && (
              <Rect
                ref={previewLineRef}
                x={0}
                y={0}
                width={0}
                height={0}
                stroke={brushColor}
                strokeWidth={brushSize}
                fill={fillEnabled ? fillColor : undefined}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                listening={false}
              />
            )}

            {/* Ellipse preview */}
            {tool === 'shape' && selectedShape === 'ellipse' && (
              <Ellipse
                ref={previewLineRef}
                x={0}
                y={0}
                radiusX={0}
                radiusY={0}
                stroke={brushColor}
                strokeWidth={brushSize}
                fill={fillEnabled ? fillColor : undefined}
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                listening={false}
              />
            )}

            {/* Triangle preview */}
            {tool === 'shape' && selectedShape === 'triangle' && (
              <Line
                ref={previewLineRef}
                points={[]}
                stroke={brushColor}
                strokeWidth={brushSize}
                fill={fillEnabled ? fillColor : undefined}
                closed
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                listening={false}
              />
            )}
          </KonvaLayer>

        </Stage>

        {/* HTML Cursor Overlay with CSS blend mode for auto-contrast */}
        {showCursor && !isPanning.current && (
          <div
            ref={cursorRef}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              pointerEvents: 'none',
              mixBlendMode: 'difference',
              zIndex: 999,
            }}
          >
            {tool === 'shape' ? (
              // Crosshair cursor for shape tool
              <svg width="20" height="20" style={{ transform: 'translate(-10px, -10px)' }}>
                <line x1="0" y1="10" x2="20" y2="10" stroke="#ffffff" strokeWidth="2" />
                <line x1="10" y1="0" x2="10" y2="20" stroke="#ffffff" strokeWidth="2" />
              </svg>
            ) : (
              // Circle cursor for pen/eraser tool
              <svg
                width={brushSize + 4}
                height={brushSize + 4}
                style={{ transform: `translate(${-(brushSize + 4) / 2}px, ${-(brushSize + 4) / 2}px)` }}
              >
                <circle
                  cx={(brushSize + 4) / 2}
                  cy={(brushSize + 4) / 2}
                  r={brushSize / 2}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              </svg>
            )}
          </div>
        )}
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

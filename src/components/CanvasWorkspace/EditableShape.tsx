import React from 'react';
import { Rect, Ellipse, Line } from 'react-konva';
import type { EditableShape } from '@/types/canvas';

type EditableShapeProps = {
  shape: EditableShape;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (attrs: Partial<EditableShape>) => void;
};

export const EditableShapeComponent: React.FC<EditableShapeProps> = ({
  shape,
  isSelected,
  onSelect,
  onChange,
}) => {
  const shapeRef = React.useRef<any>(null);

  const commonProps = {
    id: shape.id,
    x: shape.x,
    y: shape.y,
    rotation: shape.rotation,
    scaleX: shape.scaleX,
    scaleY: shape.scaleY,
    stroke: shape.strokeColor,
    strokeWidth: shape.strokeWidth,
    fill: shape.fillEnabled ? shape.fillColor : undefined,
    draggable: isSelected,
    onClick: onSelect,
    onTap: onSelect,
    onMouseEnter: (e: any) => {
      if (isSelected) {
        const container = e.target.getStage().container();
        container.style.cursor = 'move';
      }
    },
    onMouseLeave: (e: any) => {
      const container = e.target.getStage().container();
      container.style.cursor = 'none';
    },
    onDragStart: (e: any) => {
      const container = e.target.getStage().container();
      container.style.cursor = 'grabbing';
    },
    onDragEnd: (e: any) => {
      const container = e.target.getStage().container();
      container.style.cursor = 'move';
      onChange({
        x: e.target.x(),
        y: e.target.y(),
      });
    },
    onTransformEnd: () => {
      const node = shapeRef.current;
      if (!node) return;

      // Keep scale in the shape instead of absorbing into width/height
      // This prevents jitter and position jumping
      onChange({
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    },
    // Performance optimizations
    perfectDrawEnabled: false,
    shadowForStrokeEnabled: false,
  };

  switch (shape.shapeType) {
    case 'rectangle':
      return (
        <Rect
          ref={shapeRef}
          {...commonProps}
          width={shape.width}
          height={shape.height}
        />
      );

    case 'ellipse':
      return (
        <Ellipse
          ref={shapeRef}
          {...commonProps}
          radiusX={shape.width / 2}
          radiusY={shape.height / 2}
          offsetX={-shape.width / 2}
          offsetY={-shape.height / 2}
        />
      );

    case 'triangle':
      const points = [
        shape.width / 2, 0,           // Top
        shape.width, shape.height,    // Bottom right
        0, shape.height,              // Bottom left
      ];
      return (
        <Line
          ref={shapeRef}
          {...commonProps}
          points={points}
          closed
        />
      );

    default:
      return null;
  }
};

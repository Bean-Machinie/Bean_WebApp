declare module 'react-konva' {
  import { Component } from 'react';
  import Konva from 'konva';

  export interface StageProps {
    width: number;
    height: number;
    onMouseDown?: (e: any) => void;
    onMousemove?: (e: any) => void;
    onMouseup?: (e: any) => void;
    onWheel?: (e: any) => void;
    scaleX?: number;
    scaleY?: number;
    x?: number;
    y?: number;
    style?: React.CSSProperties;
    [key: string]: any;
  }

  export interface LayerProps {
    listening?: boolean;
    [key: string]: any;
  }

  export interface LineProps {
    points: number[];
    stroke?: string;
    strokeWidth?: number;
    tension?: number;
    lineCap?: string;
    lineJoin?: string;
    globalCompositeOperation?: string;
    [key: string]: any;
  }

  export interface TextProps {
    text: string;
    x?: number;
    y?: number;
    [key: string]: any;
  }

  export interface CircleProps {
    x: number;
    y: number;
    radius: number;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    dash?: number[];
    [key: string]: any;
  }

  export interface RectProps {
    x?: number;
    y?: number;
    width: number;
    height: number;
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    [key: string]: any;
  }

  export interface EllipseProps {
    x?: number;
    y?: number;
    radiusX: number;
    radiusY: number;
    stroke?: string;
    strokeWidth?: number;
    fill?: string;
    [key: string]: any;
  }

  export interface TransformerProps {
    ref?: any;
    rotateEnabled?: boolean;
    enabledAnchors?: string[];
    boundBoxFunc?: (oldBox: any, newBox: any) => any;
    [key: string]: any;
  }

  export class Stage extends Component<StageProps> {}
  export class Layer extends Component<LayerProps> {}
  export class Line extends Component<LineProps> {}
  export class Text extends Component<TextProps> {}
  export class Circle extends Component<CircleProps> {}
  export class Rect extends Component<RectProps> {}
  export class Ellipse extends Component<EllipseProps> {}
  export class Transformer extends Component<TransformerProps> {}
}

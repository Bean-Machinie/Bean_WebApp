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

  export class Stage extends Component<StageProps> {}
  export class Layer extends Component<LayerProps> {}
  export class Line extends Component<LineProps> {}
  export class Text extends Component<TextProps> {}
  export class Circle extends Component<CircleProps> {}
}

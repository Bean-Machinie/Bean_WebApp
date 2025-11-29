import React from 'react';
import { Stage, Layer, Line, Text } from 'react-konva';
import './CanvasWorkspace.css';

type DrawLine = {
  tool: string;
  points: number[];
};

function CanvasWorkspace() {
  const [tool, setTool] = React.useState('pen');
  const [lines, setLines] = React.useState<DrawLine[]>([]);
  const isDrawing = React.useRef(false);

  const handleMouseDown = (e: any) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    setLines([...lines, { tool, points: [pos.x, pos.y] }]);
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    const lastLine = lines[lines.length - 1];

    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines(lines.concat());
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  return (
    <div className="canvas-workspace">
      {/* Left Toolbar */}
      <div className="canvas-workspace__toolbar">
        <div className="canvas-workspace__toolbar-content">
          <h3 className="canvas-workspace__toolbar-title">Tools</h3>
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            className="canvas-workspace__tool-select"
          >
            <option value="pen">Pen</option>
            <option value="eraser">Eraser</option>
          </select>
        </div>
      </div>

      {/* Center Canvas Area */}
      <div className="canvas-workspace__canvas-container">
        <Stage
          width={window.innerWidth - 400}
          height={window.innerHeight}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
        >
          <Layer>
            <Text text="Just start drawing" x={5} y={30} />
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke="#df4b26"
                strokeWidth={5}
                tension={0.5}
                lineCap="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
          </Layer>
        </Stage>
      </div>

      {/* Right Sidebar */}
      <div className="canvas-workspace__sidebar">
        <div className="canvas-workspace__sidebar-content">
          <h3 className="canvas-workspace__sidebar-title">Properties</h3>
          <p className="canvas-workspace__sidebar-placeholder">
            Properties panel will appear here in Phase 2
          </p>
        </div>
      </div>
    </div>
  );
}

export default CanvasWorkspace;

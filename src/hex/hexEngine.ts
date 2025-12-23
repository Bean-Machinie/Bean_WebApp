import { Grid as HexaGrid, Hex as Hexagon } from 'hexagrid';
import type { HexWidget } from '../types/battlemap';
import type { HexCellData } from './hexTypes';

type HexGrid = InstanceType<typeof HexaGrid>;

export const buildHexGrid = (widgets: HexWidget[]): HexGrid => {
  const cells = widgets.map(
    (widget) => new Hexagon(widget.q, widget.r, { widget } as HexCellData),
  );
  return new HexaGrid(...cells);
};

export const isOccupied = (
  grid: HexGrid,
  coords: { q: number; r: number },
) => Boolean(grid.get(coords));

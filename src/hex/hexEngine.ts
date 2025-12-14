import { Grid as HexaGrid, Hex as Hexagon } from 'hexagrid';
import type { HexWidget } from '../types/battlemap';
import type { HexCellData } from './hexTypes';

export const buildHexGrid = (widgets: HexWidget[]): HexaGrid<Hexagon<HexCellData>> => {
  const cells = widgets.map(
    (widget) => new Hexagon<HexCellData>(widget.q, widget.r, { widget }),
  );
  return new HexaGrid<Hexagon<HexCellData>>(...cells);
};

export const isOccupied = (
  grid: HexaGrid<Hexagon<HexCellData>>,
  coords: { q: number; r: number },
) => Boolean(grid.get(coords));

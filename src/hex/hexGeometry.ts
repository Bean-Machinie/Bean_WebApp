import { Grid as HoneycombGrid, Orientation, defineHex } from 'honeycomb-grid';
import type { HexGridSettings } from '../types/battlemap';
import type { Cube } from './hexTypes';

export type HexGeometry = {
  grid: HoneycombGrid<any>;
  hexWidth: number;
  hexHeight: number;
  hexToPixel: (coords: { q: number; r: number }) => { x: number; y: number };
  pixelToHex: (point: { x: number; y: number }) => Cube;
  hexToCorners: (coords: { q: number; r: number }) => { x: number; y: number }[];
};

export const createHexGeometry = (settings: HexGridSettings): HexGeometry => {
  const orientation = settings.orientation === 'flat' ? Orientation.FLAT : Orientation.POINTY;
  const HexClass = defineHex({
    dimensions: settings.hexSize,
    orientation,
    origin: { x: 0, y: 0 },
  });
  const grid = new HoneycombGrid(HexClass);
  const sample = grid.createHex({ q: 0, r: 0 });
  const hexWidth = sample.width;
  const hexHeight = sample.height;

  const hexToPixel = (coords: { q: number; r: number }) => {
    const hex = grid.createHex({ q: coords.q, r: coords.r });
    return { x: hex.x, y: hex.y };
  };

  const pixelToHex = (point: { x: number; y: number }): Cube => {
    const hex = grid.pointToHex(point);
    return { q: hex.q, r: hex.r, s: hex.s };
  };

  const hexToCorners = (coords: { q: number; r: number }) => {
    const hex = grid.createHex({ q: coords.q, r: coords.r });
    return hex.corners.map((corner) => ({ x: corner.x, y: corner.y }));
  };

  return {
    grid,
    hexWidth,
    hexHeight,
    hexToPixel,
    pixelToHex,
    hexToCorners,
  };
};

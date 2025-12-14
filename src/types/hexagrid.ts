/* Runtime shim so TypeScript paths resolve without strict errors while still deferring to the actual hexagrid implementation. */
import * as HexagridRuntime from 'hexagrid/dist/index.js';

export type CubeCoordinates = { q: number; r: number; s?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runtime = HexagridRuntime as any;

export const Grid = runtime.Grid as typeof HexagridRuntime.Grid;
export const Hex = runtime.Hex as typeof HexagridRuntime.Hex;
export const Direction = runtime.Direction as typeof HexagridRuntime.Direction;

export default HexagridRuntime;

export type NamePart = [x: number, y: number, width: number, height: number];
export type NameRecord = [name: string, sourceIndex: number, parts: NamePart[]];
export type Region = { x: number; y: number; width: number; height: number };
export type CoordinateMode = 'canvas' | 'content';

export function getNameSourceBounds(records: NameRecord[], mode?: CoordinateMode): Region;
export function projectNamePart(part: NamePart, destination: Region, source: Region): Region;

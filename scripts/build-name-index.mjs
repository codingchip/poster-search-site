import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(projectRoot, '..', '欢迎新同学！-姓名坐标索引.json');
const outputPath = path.resolve(projectRoot, 'public', 'data', 'name-index.json');
const source = JSON.parse(await readFile(sourcePath, 'utf8'));

const compact = {
  version: 1,
  target: source.layout.target,
  sourceWidth: source.coordinateSpace.width,
  sourceHeight: source.coordinateSpace.height,
  nameCount: source.summary.recordCount,
  records: source.records.map((record) => [
    record.name,
    record.sourceIndex,
    record.parts.map((part) => [
      part.normalized.x,
      part.normalized.y,
      part.normalized.width,
      part.normalized.height,
    ]),
  ]),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(compact));
console.log(`Generated ${compact.nameCount} records at ${outputPath}`);

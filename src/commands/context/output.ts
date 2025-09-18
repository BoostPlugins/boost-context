import { promises as fs } from 'node:fs';
import type { MatchedFile } from './types';
import { sortByRelative } from './utils';

export const printTree = (files: MatchedFile[]): void => {
  console.log('### Tree (filtered):');

  const seen = new Set<string>();
  const sorted = sortByRelative(files);

  for (const file of sorted) {
    const segments = file.relative.split('/');

    let cursor = '';
    for (let index = 0; index < segments.length - 1; index += 1) {
      cursor = cursor.length === 0 ? segments[index] : `${cursor}/${segments[index]}`;
      if (!seen.has(cursor)) {
        seen.add(cursor);
        const indent = '  '.repeat(index);
        console.log(`  ${indent}${segments[index]}/`);
      }
    }

    const indent = '  '.repeat(Math.max(segments.length - 1, 0));
    console.log(`  ${indent}${segments[segments.length - 1]}`);
  }

  console.log('');
};

const formatHeadingPath = (relative: string): string => {
  return relative.startsWith('/') ? relative : `/${relative}`;
};

const outputFile = async (file: MatchedFile): Promise<void> => {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(file.absolute);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Error reading ${formatHeadingPath(file.relative)}]: ${message}`);
    return;
  }

  process.stdout.write(buffer);
  if (buffer.length === 0 || buffer[buffer.length - 1] !== 0x0a) {
    process.stdout.write('\n');
  }
};

export const outputFiles = async (files: MatchedFile[]): Promise<void> => {
  const sorted = sortByRelative(files);

  for (const file of sorted) {
    console.log(`===== ${formatHeadingPath(file.relative)} =====`);
    await outputFile(file);
    console.log('');
  }
};

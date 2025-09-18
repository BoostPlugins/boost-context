import path from 'node:path';
import type { MatchedFile } from './types';

export const toPosix = (value: string): string => value.split(path.sep).join('/');

export const normalizeRelative = (relative: string): string => {
  const normalized = toPosix(relative);
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
};

export const parseNullSeparated = (buffer: Buffer): string[] => {
  const text = buffer.toString('utf8');
  return text.split('\0').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
};

export const sortByRelative = (files: MatchedFile[]): MatchedFile[] => {
  return [...files].sort((a, b) => a.relative.localeCompare(b.relative));
};

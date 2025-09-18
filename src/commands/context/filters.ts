import path from 'node:path';
import picomatch from 'picomatch';
import type { CompiledPattern } from './types';
import { toPosix } from './utils';

export const compilePatterns = (patterns: string[]): CompiledPattern[] => {
  return patterns
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0)
    .map((pattern) => {
      const normalized = toPosix(pattern);
      const hasSlash = normalized.includes('/');

      const testAbsolute = picomatch(normalized, { dot: true });
      const testRelative = picomatch(normalized, { dot: true });
      const testBasename = hasSlash ? undefined : picomatch(normalized, { dot: true, basename: true });

      return {
        testAbsolute: (value: string) => testAbsolute(toPosix(value)),
        testRelative: (value: string) => testRelative(toPosix(value)),
        testBasename,
      } satisfies CompiledPattern;
    });
};

export const isExcluded = (absolute: string, relative: string, patterns: CompiledPattern[]): boolean => {
  if (patterns.length === 0) {
    return false;
  }

  const basename = path.basename(relative);

  return patterns.some(({ testAbsolute, testRelative, testBasename }) => {
    if (testAbsolute(absolute) || testRelative(relative)) {
      return true;
    }

    if (testBasename && testBasename(basename)) {
      return true;
    }

    return false;
  });
};

export const matchesExtension = (relative: string, extensions: string[]): boolean => {
  if (extensions.length === 0) {
    return true;
  }

  const ext = path.extname(relative).slice(1);
  if (ext.length === 0) {
    return false;
  }

  return extensions.includes(ext);
};

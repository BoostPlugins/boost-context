import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';
import { normalizeRelative, parseNullSeparated, toPosix } from './utils';
import type { MatchedFile } from './types';
import { BCTX_IGNORE_FILENAME } from './constants';

const readIgnoreFile = async (root: string, filename: string): Promise<string> => {
  const filePath = path.join(root, filename);
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    return contents.trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
};

export const loadIgnoreFilter = async (root: string): Promise<Ignore | null> => {
  const gitignoreContents = await readIgnoreFile(root, '.gitignore');
  const bctxIgnoreContents = await readIgnoreFile(root, BCTX_IGNORE_FILENAME);

  const combined = [gitignoreContents, bctxIgnoreContents].filter((value) => value.length > 0).join('\n');
  if (combined.length === 0) {
    return null;
  }

  return ignore().add(combined);
};

const collectWithGit = (root: string): string[] | null => {
  const result = spawnSync('git', ['-C', root, 'ls-files', '-z', '-co', '--exclude-standard'], {
    encoding: 'buffer',
  });

  if (result.error || result.status !== 0 || !result.stdout) {
    return null;
  }

  return parseNullSeparated(result.stdout);
};

const collectWithRipgrep = (root: string): string[] | null => {
  const result = spawnSync('rg', ['--files', '-0', '--hidden', '-g', '!.git/'], {
    cwd: root,
    encoding: 'buffer',
  });

  if (result.error || result.status !== 0 || !result.stdout) {
    return null;
  }

  return parseNullSeparated(result.stdout);
};

const walkFilesystem = async (root: string): Promise<string[]> => {
  const queue: string[] = [root];
  const files: string[] = [];

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === '.git') {
        continue;
      }

      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(absolute);
        continue;
      }

      if (entry.isFile() || entry.isSymbolicLink()) {
        const relative = path.relative(root, absolute) || entry.name;
        files.push(toPosix(relative));
      }
    }
  }

  return files;
};

export const collectCandidatePaths = async (root: string): Promise<string[]> => {
  const viaGit = collectWithGit(root);
  if (viaGit && viaGit.length > 0) {
    return viaGit.map((item) => toPosix(item));
  }

  const viaRipgrep = collectWithRipgrep(root);
  if (viaRipgrep && viaRipgrep.length > 0) {
    return viaRipgrep.map((item) => toPosix(item));
  }

  return walkFilesystem(root);
};

export const buildMatchedFiles = (root: string, candidates: string[]): MatchedFile[] => {
  return candidates.map((relative) => {
    const normalized = normalizeRelative(relative);
    return {
      relative: normalized,
      absolute: path.resolve(root, normalized),
      isContentExcluded: false,
    } satisfies MatchedFile;
  });
};

export const verifyRoot = async (root: string): Promise<void> => {
  const stat = await fs.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Directory not found: ${root}`);
  }
};

import { Command } from 'commander';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import ignore, { type Ignore } from 'ignore';
import picomatch from 'picomatch';

interface ContextOptions {
  cwd?: string;
  exclude?: string[];
}

interface MatchedFile {
  absolute: string;
  relative: string;
}

interface CompiledPattern {
  testAbsolute: (value: string) => boolean;
  testRelative: (value: string) => boolean;
  testBasename?: (value: string) => boolean;
}

const collectOption = (value: string, previous: string[] = []): string[] => {
  if (!value) {
    return previous;
  }

  return [...previous, value];
};

const loadIgnoreFilter = async (root: string): Promise<Ignore | null> => {
  const file = path.join(root, '.gitignore');

  try {
    const contents = await fs.readFile(file, 'utf8');
    if (contents.trim().length === 0) {
      return null;
    }

    return ignore().add(contents);
  } catch (error) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
};

const toPosix = (value: string): string => value.split(path.sep).join('/');

const parseExtensions = (rawExtensions: string[]): string[] => {
  if (!rawExtensions || rawExtensions.length === 0) {
    return [];
  }

  const unique = new Set<string>();

  for (const raw of rawExtensions) {
    const pieces = raw.split('|');
    for (const piece of pieces) {
      const trimmed = piece.trim().replace(/^\./, '');
      if (trimmed.length > 0) {
        unique.add(trimmed);
      }
    }
  }

  return Array.from(unique);
};

const compilePatterns = (patterns: string[]): CompiledPattern[] => {
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

const isExcluded = (absolute: string, relative: string, patterns: CompiledPattern[]): boolean => {
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

const matchesExtension = (relative: string, extensions: string[]): boolean => {
  if (extensions.length === 0) {
    return true;
  }

  const ext = path.extname(relative).slice(1);
  if (ext.length === 0) {
    return false;
  }

  return extensions.includes(ext);
};

const parseNullSeparated = (buffer: Buffer): string[] => {
  const text = buffer.toString('utf8');
  return text.split('\0').map((entry) => entry.trim()).filter((entry) => entry.length > 0);
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

const collectCandidatePaths = async (root: string): Promise<string[]> => {
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

const normalizeRelative = (relative: string): string => {
  const normalized = toPosix(relative);
  return normalized.startsWith('./') ? normalized.slice(2) : normalized;
};

const buildMatchedFiles = (root: string, candidates: string[]): MatchedFile[] => {
  return candidates.map((relative) => {
    const normalized = normalizeRelative(relative);
    return {
      relative: normalized,
      absolute: path.resolve(root, normalized),
    } satisfies MatchedFile;
  });
};

const verifyRoot = async (root: string): Promise<void> => {
  const stat = await fs.stat(root).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Directory not found: ${root}`);
  }
};

const sortByRelative = (files: MatchedFile[]): MatchedFile[] => {
  return [...files].sort((a, b) => a.relative.localeCompare(b.relative));
};

const printTree = (files: MatchedFile[]): void => {
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

const outputFile = async (file: MatchedFile): Promise<void> => {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(file.absolute);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Error reading ${file.relative}]: ${message}`);
    return;
  }

  process.stdout.write(buffer);
  if (buffer.length === 0 || buffer[buffer.length - 1] !== 0x0a) {
    process.stdout.write('\n');
  }
};

const outputFiles = async (files: MatchedFile[]): Promise<void> => {
  const sorted = sortByRelative(files);

  for (const file of sorted) {
    console.log(`===== ${file.relative} =====`);
    await outputFile(file);
    console.log('');
  }
};

const runContext = async (
  command: Command,
  rawExtensions: string[],
  { cwd = '.', exclude = [] }: ContextOptions,
): Promise<void> => {
  const root = path.resolve(cwd);
  await verifyRoot(root);

  const extensions = parseExtensions(rawExtensions);
  const compiledPatterns = compilePatterns(exclude);
  const ignoreFilter = await loadIgnoreFilter(root);

  const candidates = await collectCandidatePaths(root);
  const files = buildMatchedFiles(root, candidates).filter((file) => {
    if (ignoreFilter && ignoreFilter.ignores(file.relative)) {
      return false;
    }

    if (!matchesExtension(file.relative, extensions)) {
      return false;
    }

    return !isExcluded(file.absolute, file.relative, compiledPatterns);
  });

  if (files.length === 0) {
    console.error('[bctx] No files matched filters.');
    return;
  }

  printTree(files);
  await outputFiles(files);
};

export const buildContextCommand = (): Command => {
  const command = new Command('context');

  command
    .description('Print a filtered directory tree and matching file contents, honouring .gitignore rules.')
    .argument('[extensions...]', 'extensions to include (space or | separated, leading dot optional).')
    .option('-C, --cwd <dir>', 'root directory to scan', '.')
    .option('-x, --exclude <pattern>', 'glob pattern to exclude (repeatable).', collectOption, [])
    .allowExcessArguments(false)
    .action(async (extensions: string[], options: ContextOptions, cmd: Command) => {
      try {
        await runContext(cmd, extensions ?? [], options);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        cmd.error(message);
      }
    });

  return command;
};

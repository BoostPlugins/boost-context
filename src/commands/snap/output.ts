import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type PngPath = `${string}.png`;

const DEFAULT_FILENAME_PREFIX = 'bctx-browser';

const sanitizeForFilename = (value: string): string => {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return sanitized.length > 0 ? sanitized : 'page';
};

const ensurePngExtension = (value: string): PngPath => {
  const ext = path.extname(value);
  if (ext.toLowerCase() === '.png') {
    return value as PngPath;
  }

  return `${value}.png` as PngPath;
};

const expandHome = (value: string): string => {
  if (!value.startsWith('~')) {
    return value;
  }

  return path.join(os.homedir(), value.slice(1));
};

const ensureDirectory = (directory: string): string | null => {
  try {
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  } catch {
    return null;
  }
};

const readEnvironmentOverride = (): string | null => {
  const override = process.env.BCTX_SCREENSHOT_DIR;
  if (!override) {
    return null;
  }

  return path.resolve(expandHome(override));
};

const readMacScreenshotLocation = (): string | null => {
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    const output = execSync('defaults read com.apple.screencapture location', { encoding: 'utf8' })
      .trim();

    if (!output) {
      return null;
    }

    return path.resolve(expandHome(output));
  } catch {
    return null;
  }
};

let cachedDirectory: string | null = null;

const defaultScreenshotDirectory = (): string => {
  if (cachedDirectory) {
    return cachedDirectory;
  }

  const candidates: Array<() => string | null> = [
    readEnvironmentOverride,
    readMacScreenshotLocation,
    () => path.join(os.homedir(), 'Desktop'),
    () => process.cwd(),
  ];

  for (const candidate of candidates) {
    try {
      const value = candidate();
      if (!value) {
        continue;
      }

      const directory = ensureDirectory(value);
      if (directory) {
        cachedDirectory = directory;
        return directory;
      }
    } catch {
      // Ignore candidate failures and keep trying fallbacks.
    }
  }

  cachedDirectory = process.cwd();
  return cachedDirectory;
};

const formatTimestamp = (date: Date): string => {
  const pad = (value: number): string => value.toString().padStart(2, '0');

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}.${pad(date.getMinutes())}.${pad(date.getSeconds())}`,
  ].join(' at ');
};

const buildDefaultFilename = (): string => {
  return `${DEFAULT_FILENAME_PREFIX} ${formatTimestamp(new Date())}`;
};

export const resolveOutputPath = (_targetUrl: URL, _width: number, provided?: string): PngPath => {
  if (provided) {
    return path.resolve(process.cwd(), ensurePngExtension(provided)) as PngPath;
  }

  const baseName = buildDefaultFilename();
  const fileName = ensurePngExtension(baseName);
  const directory = defaultScreenshotDirectory();

  return path.resolve(directory, fileName) as PngPath;
};

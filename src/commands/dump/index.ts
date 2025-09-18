import { Command } from 'commander';
import path from 'node:path';
import type { ContextOptions } from './types';
import { collectCandidatePaths, buildMatchedFiles, loadIgnoreFilter, verifyRoot } from './fs';
import { compilePatterns, isExcluded, matchesExtension } from './filters';
import { outputFiles, printTree } from './output';
import { collectOption, parseExtensions } from './options';

const runContext = async (
  _command: Command,
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

export const buildDumpCommand = (): Command => {
  const command = new Command('dump');

  command
    .description('Dump a filtered directory tree and matching file contents, honouring .gitignore rules.')
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

export type { ContextOptions };

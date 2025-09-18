import type { Command } from 'commander';
import { buildSnapCommand } from './browser/index';
import { buildTeeCommand } from './capture/index';
import { buildDumpCommand } from './context/index';

/** Attach the available sub-commands and default behaviour to the provided program. */
export const registerCommands = (program: Command): void => {
  program.action(() => {
    program.help({ error: false });
  });

  program.addCommand(buildDumpCommand());
  program.addCommand(buildTeeCommand());
  program.addCommand(buildSnapCommand());
};

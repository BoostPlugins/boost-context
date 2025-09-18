import type { Command } from 'commander';
import { buildSnapCommand } from './snap/index';
import { buildTeeCommand } from './tee/index';
import { buildDumpCommand } from './dump/index';

/** Attach the available sub-commands and default behaviour to the provided program. */
export const registerCommands = (program: Command): void => {
  program.action(() => {
    program.help({ error: false });
  });

  program.addCommand(buildDumpCommand());
  program.addCommand(buildTeeCommand());
  program.addCommand(buildSnapCommand());
};

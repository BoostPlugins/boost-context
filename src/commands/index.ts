import type { Command } from 'commander';
import { buildContextCommand } from './context';
import { buildEchoCommand, echoFirst } from './echo';

const helpOnEmpty = (program: Command, values: unknown): void => {
  const list = Array.isArray(values) ? (values as string[]) : [];

  if (list.length === 0) {
    program.outputHelp();
    return;
  }

  echoFirst(list);
};

/** Attach the available sub-commands and default behaviour to the provided program. */
export const registerCommands = (program: Command): void => {
  program
    .argument('[values...]', 'values to process (only the first value is echoed)')
    .action((values) => {
      helpOnEmpty(program, values);
    });

  program.addCommand(buildEchoCommand());
  program.addCommand(buildContextCommand());
};

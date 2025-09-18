import { Command } from 'commander';

/** Print the first available value to stdout. */
export const echoFirst = (values: string[]): void => {
  const [first] = values;

  if (typeof first === 'string') {
    console.log(first);
  }
};

/** Build the `echo` sub-command. */
export const buildEchoCommand = (): Command => {
  const command = new Command('echo');

  command
    .description('Echo the first argument back to stdout.')
    .argument('<values...>', 'values to inspect (only the first will be echoed)')
    .action((values: string[]) => {
      if (!Array.isArray(values) || values.length === 0) {
        command.error('Please supply at least one value to echo.');
        return;
      }

      echoFirst(values);
    });

  return command;
};

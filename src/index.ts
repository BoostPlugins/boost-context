import { Command } from 'commander';
import packageJson from '../package.json';
import { registerCommands } from './commands';

/**
 * Factory that wires the CLI program together. Exported for testing and reuse.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('bctx')
    .description('Boost Context CLI utilities')
    .version(packageJson.version)
    .showHelpAfterError('(use --help for usage information)');

  registerCommands(program);

  return program;
}

/** Parse and execute the CLI with the given argv (defaults to process.argv). */
export async function run(argv: readonly string[] = process.argv): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

if (require.main === module) {
  run().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}

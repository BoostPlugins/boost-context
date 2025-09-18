import { Command } from 'commander';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const DEFAULT_CAPTURE_PREFIX = 'bctx-capture';
const DEFAULT_CAPTURE_EXTENSION = '.log';

const createTeeStream = (destination: fs.WriteStream): Writable => {
  destination.on('error', (error) => {
    destination.destroy(error);
  });

  return new Writable({
    write(chunk, _encoding, callback) {
      destination.write(chunk, (writeError) => {
        if (writeError) {
          callback(writeError);
          return;
        }

        if (!process.stdout.write(chunk)) {
          process.stdout.once('drain', callback);
          return;
        }

        callback();
      });
    },
    final(callback) {
      destination.end(callback);
    },
  });
};

const expandHome = (value: string): string => {
  if (!value.startsWith('~')) {
    return value;
  }

  return path.join(os.homedir(), value.slice(1));
};

const formatTimestamp = (date: Date): string => {
  const pad = (input: number): string => input.toString().padStart(2, '0');

  const datePart = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;

  return `${datePart}-${timePart}`;
};

const prepareDirectory = async (directory: string): Promise<string> => {
  await fs.promises.mkdir(directory, { recursive: true });
  return directory;
};

const resolveOutputPath = async (requestedPath?: string): Promise<string> => {
  if (requestedPath && requestedPath.trim().length > 0) {
    const resolved = path.resolve(process.cwd(), requestedPath);
    await prepareDirectory(path.dirname(resolved));
    return resolved;
  }

  const override = process.env.BCTX_CAPTURE_DIR?.trim();
  const baseDirectory = override
    ? await prepareDirectory(path.resolve(process.cwd(), expandHome(override)))
    : await prepareDirectory(process.cwd());

  const timestamp = formatTimestamp(new Date());
  const filename = `${DEFAULT_CAPTURE_PREFIX}-${timestamp}${DEFAULT_CAPTURE_EXTENSION}`;

  return path.join(baseDirectory, filename);
};

export const buildTeeCommand = (): Command => {
  const command = new Command('tee');

  command
    .description('Copy stdin to a file while echoing it to stdout (a tee with nice defaults).')
    .argument('[file]', 'File path to write the captured data to. Defaults to a timestamped file in the current directory.')
    .action(async (relativePath: string | undefined, _options, cmd: Command) => {
      let outputPath: string;
      try {
        outputPath = await resolveOutputPath(relativePath);
      } catch (error) {
        cmd.error(`Failed to prepare output file: ${(error as Error).message}`);
        return;
      }

      const fileStream = fs.createWriteStream(outputPath, { flags: 'w' });

      try {
        const tee = createTeeStream(fileStream);
        await pipeline(process.stdin, tee);
      } catch (error) {
        fileStream.destroy();
        cmd.error((error as Error).message);
      }
    });

  return command;
};

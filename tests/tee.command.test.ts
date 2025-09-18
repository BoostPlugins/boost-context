import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CLI_ENTRY = path.resolve(__dirname, '..', 'dist', 'index.js');

const createWorkspace = (): string => mkdtempSync(path.join(os.tmpdir(), 'bctx-tee-'));

const runTee = (cwd: string, args: string[], input: string, env: NodeJS.ProcessEnv = process.env) => {
  return spawnSync('node', [CLI_ENTRY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...env, FORCE_COLOR: '0' },
    input,
  });
};

describe('tee command', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('writes stdin to the specified file and echoes it', () => {
    const input = 'Alpha\nBeta\n';
    const result = runTee(workspace, ['tee', 'output.txt'], input);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toBe(input);

    const contents = readFileSync(path.join(workspace, 'output.txt'), 'utf8');
    expect(contents).toBe(input);
  });

  it('creates parent directories when needed', () => {
    const input = 'Nested\n';
    const destination = path.join('logs', 'latest', 'capture.txt');

    const result = runTee(workspace, ['tee', destination], input);

    expect(result.status).toBe(0);

    const contents = readFileSync(path.join(workspace, destination), 'utf8');
    expect(contents).toBe(input);
  });

  it('uses a timestamped default file when none is provided', () => {
    const input = 'Default capture\n';

    const result = runTee(workspace, ['tee'], input);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(input);

    const files = readdirSync(workspace);
    const captureFile = files.find((file) => /^bctx-capture-\d{8}-\d{6}\.log$/.test(file));

    expect(captureFile).toBeDefined();

    if (!captureFile) {
      throw new Error('Expected capture file to be created');
    }

    const contents = readFileSync(path.join(workspace, captureFile), 'utf8');
    expect(contents).toBe(input);
  });

  it('respects BCTX_CAPTURE_DIR override', () => {
    const input = 'Env capture\n';
    const envDir = path.join(workspace, 'captures');

    const result = runTee(
      workspace,
      ['tee'],
      input,
      { ...process.env, BCTX_CAPTURE_DIR: envDir },
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toBe(input);

    const files = readdirSync(envDir);
    const captureFile = files.find((file) => /^bctx-capture-\d{8}-\d{6}\.log$/.test(file));

    expect(captureFile).toBeDefined();

    if (!captureFile) {
      throw new Error('Expected capture file to be created');
    }

    const contents = readFileSync(path.join(envDir, captureFile), 'utf8');
    expect(contents).toBe(input);
  });
});

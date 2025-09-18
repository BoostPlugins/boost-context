import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

type CliResult = {
  stdout: string;
  stderr: string;
  status: number | null;
};

const CLI_ENTRY = path.resolve(__dirname, '..', 'dist', 'index.js');

const createWorkspace = (): string => mkdtempSync(path.join(os.tmpdir(), 'bctx-test-'));

const write = (root: string, relativePath: string, contents: string): void => {
  const destination = path.join(root, relativePath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, contents, 'utf8');
};

const runCli = (cwd: string, args: string[]): CliResult => {
  const result = spawnSync('node', [CLI_ENTRY, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0' },
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
};

describe('dump CLI integration', () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  afterEach(() => {
    rmSync(workspace, { recursive: true, force: true });
  });

  it('prints a tree and matching file contents filtered by extensions and .gitignore', () => {
    write(workspace, '.gitignore', 'ignored.ts\n');
    write(workspace, 'alpha.ts', "export const alpha = 'A';\n");
    write(workspace, 'beta.tsx', "export const beta = 'B';\n");
    write(workspace, 'ignored.ts', 'should be hidden\n');
    write(workspace, 'docs/readme.md', '# readme\n');
    write(workspace, 'nested/gamma.ts', "export const gamma = 'G';\n");

    const { stdout, stderr, status } = runCli(workspace, ['dump', 'ts', 'tsx']);

    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('### Tree (filtered):');
    expect(stdout).toContain('alpha.ts');
    expect(stdout).toContain('nested/');
    expect(stdout).toContain('nested/gamma.ts');
    expect(stdout).toContain('===== /alpha.ts =====');
    expect(stdout).toContain("export const alpha = 'A';");
    expect(stdout).toContain('===== /nested/gamma.ts =====');
    expect(stdout).not.toContain('ignored.ts');
    expect(stdout).not.toContain('docs/readme.md');
  });

  it('honours exclude patterns', () => {
    write(workspace, 'keep.ts', 'include me\n');
    write(workspace, 'skip-me.ts', 'skip me\n');

    const { stdout, stderr, status } = runCli(workspace, ['dump', '-x', '*skip*', 'ts']);

    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('keep.ts');
    expect(stdout).not.toContain('skip-me.ts');
  });

  it('supports comma-separated excludes within a single flag', () => {
    write(workspace, 'keep.ts', 'include me\n');
    write(workspace, 'omit-one.ts', 'omit\n');
    write(workspace, 'omit-two.ts', 'omit\n');

    const { stdout, stderr, status } = runCli(workspace, ['dump', '-x', 'omit-one.ts,omit-two.ts', 'ts']);

    expect(status).toBe(0);
    expect(stderr).toBe('');
    expect(stdout).toContain('keep.ts');
    expect(stdout).not.toContain('omit-one.ts');
    expect(stdout).not.toContain('omit-two.ts');
  });

  it('prints informative message when no files match', () => {
    write(workspace, 'note.md', '# note\n');

    const result = runCli(workspace, ['dump', 'ts']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toContain('No files matched filters');
  });
});

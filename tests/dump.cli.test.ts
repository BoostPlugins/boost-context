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

  it('shows all files in tree but hides content for files matching .gitignore, .bctxignore, or -x flag', () => {
    write(workspace, '.gitignore', 'ignored-by-git.ts\n');
    write(workspace, '.bctxignore', '*.css\nignored-by-bctx.ts\n');
    write(workspace, 'src/components/Button.tsx', 'export const Button = () => {};\n');
    write(workspace, 'src/components/Button.css', '.button { color: red; }\n');
    write(workspace, 'src/lib/api.ts', '// API logic\n');
    write(workspace, 'src/lib/ignored-by-git.ts', '// Should not see this content\n');
    write(workspace, 'src/lib/ignored-by-bctx.ts', '// Should not see this content either\n');
    write(workspace, 'src/tests/ignored-by-cli.test.ts', '// Test file content\n');

    const { stdout, stderr, status } = runCli(workspace, ['dump', 'tsx', 'ts', 'css', '-x', '**/*.test.ts']);

    expect(status).toBe(0);
    expect(stderr).toBe('');

    expect(stdout).toContain('### Tree (filtered):');
    expect(stdout).toContain('src/');
    expect(stdout).toContain('components/');
    expect(stdout).toContain('Button.tsx');
    expect(stdout).toContain('Button.css');
    expect(stdout).toContain('lib/');
    expect(stdout).toContain('api.ts');
    expect(stdout).toContain('ignored-by-git.ts');
    expect(stdout).toContain('ignored-by-bctx.ts');
    expect(stdout).toContain('tests/');
    expect(stdout).toContain('ignored-by-cli.test.ts');

    expect(stdout).toContain('===== /src/components/Button.tsx =====');
    expect(stdout).toContain('export const Button = () => {};');
    expect(stdout).toContain('===== /src/lib/api.ts =====');
    expect(stdout).toContain('// API logic');

    expect(stdout).not.toContain('===== /src/components/Button.css =====');
    expect(stdout).not.toContain('.button { color: red; }');
    expect(stdout).not.toContain('===== /src/lib/ignored-by-git.ts =====');
    expect(stdout).not.toContain('// Should not see this content');
    expect(stdout).not.toContain('===== /src/lib/ignored-by-bctx.ts =====');
    expect(stdout).not.toContain('===== /src/tests/ignored-by-cli.test.ts =====');
    expect(stdout).not.toContain('// Test file content');
  });

  it('prints informative message when no files match', () => {
    write(workspace, 'note.md', '# note\n');

    const result = runCli(workspace, ['dump', 'ts']);

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('');
    expect(result.stderr).toContain('No files matched the extension filters');
  });
});

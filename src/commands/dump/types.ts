export interface ContextOptions {
  cwd?: string;
  exclude?: string[];
}

export interface MatchedFile {
  absolute: string;
  relative: string;
}

export interface CompiledPattern {
  testAbsolute: (value: string) => boolean;
  testRelative: (value: string) => boolean;
  testBasename?: (value: string) => boolean;
}

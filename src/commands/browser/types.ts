export interface BrowserCommandOptions {
  width?: string;
  wait?: string;
  output?: string;
  header?: string[];
  request?: string;
  data?: string[];
  userAgent?: string;
  user?: string;
  cookie?: string[];
  cookieFile?: string;
  compressed?: boolean;
  insecure?: boolean;
}

export interface NetworkConfiguration {
  method: string;
  headers: Record<string, string>;
  postData?: string;
  userAgent?: string;
  credentials?: {
    username: string;
    password: string;
  };
  shouldIntercept: boolean;
  launchArgs: string[];
}

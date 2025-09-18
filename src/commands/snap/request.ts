import { Buffer } from 'node:buffer';
import type { BrowserCommandOptions, NetworkConfiguration } from './types';

export const appendCliValue = (value: string, previous: string[] = []): string[] => {
  if (typeof value !== 'string') {
    return previous;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return previous;
  }

  return [...previous, trimmed];
};

const parseHeaderLine = (line: string): { name: string; value: string } => {
  const index = line.indexOf(':');
  if (index === -1) {
    throw new Error(`Invalid header "${line}". Use the format "Name: value".`);
  }

  const name = line.slice(0, index).trim();
  const value = line.slice(index + 1).trim();

  if (!name) {
    throw new Error(`Header name missing in "${line}".`);
  }

  if (value.length === 0) {
    throw new Error(`Header value missing for "${name}".`);
  }

  return { name, value };
};

const createHeaderStore = () => {
  const headers: Record<string, string> = {};
  const lookup = new Map<string, string>();

  const set = (name: string, value: string) => {
    const lower = name.toLowerCase();
    const canonical = lookup.get(lower) ?? name;
    headers[canonical] = value;
    lookup.set(lower, canonical);
  };

  const has = (name: string): boolean => lookup.has(name.toLowerCase());

  const toRecord = (): Record<string, string> => ({ ...headers });

  return { set, has, toRecord };
};

const parseCredentials = (
  raw?: string,
): { username: string; password: string } | undefined => {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error('Credentials provided via --user must not be empty.');
  }

  const separator = trimmed.indexOf(':');
  if (separator === -1) {
    return { username: trimmed, password: '' };
  }

  const username = trimmed.slice(0, separator).trim();
  const password = trimmed.slice(separator + 1).trim();

  if (!username) {
    throw new Error('Username part of --user must not be empty.');
  }

  return { username, password };
};

export const buildNetworkConfiguration = (options: BrowserCommandOptions): NetworkConfiguration => {
  const headerStore = createHeaderStore();

  for (const header of options.header ?? []) {
    const { name, value } = parseHeaderLine(header);
    headerStore.set(name, value);
  }

  if (options.cookie && options.cookie.length > 0 && !headerStore.has('cookie')) {
    headerStore.set('Cookie', options.cookie.join('; '));
  }

  if (options.compressed && !headerStore.has('accept-encoding')) {
    headerStore.set('Accept-Encoding', 'gzip, deflate, br');
  }

  const dataPieces = options.data ?? [];
  const hasData = dataPieces.length > 0;
  const postData = hasData ? dataPieces.join('&') : undefined;

  if (hasData && !headerStore.has('content-type')) {
    headerStore.set('Content-Type', 'application/x-www-form-urlencoded');
  }

  let method: string | undefined;
  if (options.request) {
    const requested = options.request.trim().toUpperCase();
    if (requested.length === 0) {
      throw new Error('Request method provided via --request must not be empty.');
    }

    method = requested;
  }

  if (!method) {
    method = hasData ? 'POST' : 'GET';
  }

  const credentials = parseCredentials(options.user);

  if (credentials && !headerStore.has('authorization')) {
    const value = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
    headerStore.set('Authorization', `Basic ${value}`);
  }

  const launchArgs: string[] = [];
  if (options.insecure) {
    launchArgs.push('--ignore-certificate-errors');
  }

  const headers = headerStore.toRecord();
  const shouldIntercept = method !== 'GET' || hasData;

  return {
    method,
    headers,
    postData,
    userAgent: options.userAgent?.trim() || undefined,
    credentials,
    shouldIntercept,
    launchArgs,
  } satisfies NetworkConfiguration;
};

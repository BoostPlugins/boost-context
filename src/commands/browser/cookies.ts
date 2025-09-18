import fs from 'node:fs/promises';
import path from 'node:path';
import type { CookieParam } from 'puppeteer';

const decodeJsonCookies = (raw: unknown, fallbackUrl: URL): CookieParam[] => {
  if (!Array.isArray(raw)) {
    throw new Error('Cookie JSON must be an array.');
  }

  return raw.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Cookie at index ${index} must be an object.`);
    }

    const cookie = entry as Record<string, unknown>;

    const name = cookie.name;
    const value = cookie.value;

    if (typeof name !== 'string' || typeof value !== 'string') {
      throw new Error(`Cookie at index ${index} is missing a string name or value.`);
    }

    const domain = typeof cookie.domain === 'string' ? cookie.domain : undefined;
    const pathValue = typeof cookie.path === 'string' ? cookie.path : '/';

    const base: CookieParam = {
      name,
      value,
      path: pathValue,
    };

    if (domain) {
      base.domain = domain;
    } else {
      base.url = fallbackUrl.origin;
    }

    if (typeof cookie.expires === 'number') {
      base.expires = cookie.expires;
    }

    if (typeof cookie.httpOnly === 'boolean') {
      base.httpOnly = cookie.httpOnly;
    }

    if (typeof cookie.secure === 'boolean') {
      base.secure = cookie.secure;
    }

    if (typeof cookie.sameSite === 'string') {
      const sameSite = cookie.sameSite.toLowerCase();
      if (sameSite === 'strict' || sameSite === 'lax' || sameSite === 'none') {
        base.sameSite = sameSite.charAt(0).toUpperCase() + sameSite.slice(1) as CookieParam['sameSite'];
      }
    }

    return base;
  });
};

const parseNetscapeLine = (line: string, fallbackUrl: URL): CookieParam | null => {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.startsWith('#')) {
    if (trimmed.startsWith('#HttpOnly_')) {
      return parseNetscapeLine(trimmed.replace(/^#HttpOnly_/, ''), fallbackUrl);
    }

    return null;
  }

  const httpOnly = trimmed.startsWith('#HttpOnly_');
  const effective = httpOnly ? trimmed.replace(/^#HttpOnly_/, '') : trimmed;
  const pieces = effective.split(/\t+/);
  if (pieces.length < 7) {
    throw new Error(`Invalid Netscape cookie line: "${line}"`);
  }

  const [domainRaw, includeSub, pathValue, secureFlag, expiresRaw, name, value] = pieces;

  const domain = domainRaw.trim();
  const includeSubdomains = includeSub.trim().toUpperCase() === 'TRUE';
  const secure = secureFlag.trim().toUpperCase() === 'TRUE';

  const cookie: CookieParam = {
    name,
    value,
    path: pathValue || '/',
    secure,
    httpOnly,
  };

  if (domain) {
    cookie.domain = includeSubdomains && !domain.startsWith('.') ? `.${domain}` : domain;
  } else {
    cookie.url = fallbackUrl.origin;
  }

  const expires = Number(expiresRaw);
  if (Number.isFinite(expires) && expires > 0) {
    cookie.expires = expires;
  }

  return cookie;
};

const decodeNetscapeCookies = (text: string, fallbackUrl: URL): CookieParam[] => {
  const lines = text.split(/\r?\n/);
  const cookies: CookieParam[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    if (line.startsWith('#') && !line.startsWith('#HttpOnly_')) {
      continue;
    }

    const parsed = parseNetscapeLine(line, fallbackUrl);
    if (parsed) {
      cookies.push(parsed);
    }
  }

  return cookies;
};

export const loadCookiesFromFile = async (filePath: string, fallbackUrl: URL): Promise<CookieParam[]> => {
  const resolved = path.resolve(process.cwd(), filePath);
  const contents = await fs.readFile(resolved, 'utf8');
  const trimmed = contents.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    return decodeJsonCookies(parsed, fallbackUrl);
  }

  return decodeNetscapeCookies(trimmed, fallbackUrl);
};

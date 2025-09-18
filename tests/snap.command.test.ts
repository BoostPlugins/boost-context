import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { buildSnapCommand } from '../src/commands/browser';

jest.mock('puppeteer', () => {
  const launch = jest.fn();
  return {
    __esModule: true,
    default: { launch },
    launch,
  };
});

type MockedLaunch = jest.MockedFunction<typeof puppeteer.launch>;

type PageMocks = {
  setViewport: jest.Mock;
  goto: jest.Mock;
  waitForTimeout: jest.Mock;
  screenshot: jest.Mock;
  setExtraHTTPHeaders: jest.Mock;
  setUserAgent: jest.Mock;
  setRequestInterception: jest.Mock;
  on: jest.Mock;
  off: jest.Mock;
  authenticate: jest.Mock;
  setCookie: jest.Mock;
};

type BrowserMocks = {
  newPage: jest.Mock;
  close: jest.Mock;
};

const createCommand = () => {
  const command = buildSnapCommand();
  command.exitOverride();
  return command;
};

const setupLaunchMock = () => {
  const launchMock = puppeteer.launch as MockedLaunch;

  const requestContinue = jest.fn().mockResolvedValue(undefined);
  const requestAbort = jest.fn().mockResolvedValue(undefined);
  const requestHeaders = jest.fn().mockReturnValue({ existing: 'header' });
  const requestMethod = jest.fn().mockReturnValue('GET');
  const requestIsNavigation = jest.fn().mockReturnValue(true);

  const fakeRequest = {
    continue: requestContinue,
    abort: requestAbort,
    headers: requestHeaders,
    method: requestMethod,
    isNavigationRequest: requestIsNavigation,
  };

  let requestHandler: ((request: typeof fakeRequest) => Promise<void> | void) | undefined;

  const pageMocks: PageMocks = {
    setViewport: jest.fn().mockResolvedValue(undefined),
    goto: jest.fn(async () => {
      if (requestHandler) {
        await requestHandler(fakeRequest);
      }
    }),
    waitForTimeout: jest.fn().mockResolvedValue(undefined),
    screenshot: jest.fn().mockResolvedValue(undefined),
    setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
    setUserAgent: jest.fn().mockResolvedValue(undefined),
    setRequestInterception: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    authenticate: jest.fn().mockResolvedValue(undefined),
    setCookie: jest.fn().mockResolvedValue(undefined),
  };

  const page = pageMocks as unknown as Page;

  pageMocks.on.mockImplementation((event: string, handler: typeof requestHandler) => {
    if (event === 'request' && handler) {
      requestHandler = handler;
    }
    return page;
  });

  pageMocks.off.mockImplementation((event: string, handler: typeof requestHandler) => {
    if (event === 'request' && handler === requestHandler) {
      requestHandler = undefined;
    }
    return page;
  });

  const browserMocks: BrowserMocks = {
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const browser = browserMocks as unknown as Browser;

  launchMock.mockResolvedValue(browser);

  return { launchMock, pageMocks, browserMocks, fakeRequest };
};

describe('snap command', () => {
  const originalDir = process.env.BCTX_SCREENSHOT_DIR;
  const screenshotDir = path.join(os.tmpdir(), 'bctx-browser-test-output');

  beforeEach(() => {
    jest.clearAllMocks();
    rmSync(screenshotDir, { recursive: true, force: true });
    process.env.BCTX_SCREENSHOT_DIR = screenshotDir;
  });

  afterAll(() => {
    rmSync(screenshotDir, { recursive: true, force: true });
    process.env.BCTX_SCREENSHOT_DIR = originalDir;
  });

  it('applies Tailwind width aliases', async () => {
    const command = createCommand();
    const { launchMock, pageMocks, browserMocks } = setupLaunchMock();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await command.parseAsync(['node', 'snap', 'https://example.com', '--width', 'sm'], { from: 'user' });

    expect(launchMock).toHaveBeenCalledWith({ headless: true });
    expect(pageMocks.setViewport).toHaveBeenCalledWith({ width: 640, height: 900 });
    expect(pageMocks.setRequestInterception).not.toHaveBeenCalled();
    expect(pageMocks.setCookie).not.toHaveBeenCalled();
    expect(pageMocks.waitForTimeout).not.toHaveBeenCalled();
    expect(pageMocks.screenshot).toHaveBeenCalledWith(
      expect.objectContaining({
        fullPage: true,
        type: 'png',
        path: expect.stringContaining(`bctx-browser `),
      }),
    );
    expect(browserMocks.close).toHaveBeenCalledTimes(1);

    logSpy.mockRestore();
  });

  it('honours explicit pixel widths, wait times, and curl-like options', async () => {
    const command = createCommand();
    const { launchMock, pageMocks, fakeRequest } = setupLaunchMock();
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const cookieFile = path.join(screenshotDir, 'cookies.txt');
    mkdirSync(screenshotDir, { recursive: true });
    // Netscape cookie format (domain TRUE path secure expiry name value)
    writeFileSync(
      cookieFile,
      '# Netscape HTTP Cookie File\n.example.org\tTRUE\t/\tFALSE\t2147483647\tfoo\tbar',
      'utf8',
    );

    await command.parseAsync(
      [
        'node',
        'snap',
        'https://example.org/foo',
        '--width',
        '900',
        '--wait',
        '250',
        '--data',
        'alpha=1',
        '--data',
        'beta=2',
        '--header',
        'X-Test: 123',
        '--request',
        'put',
        '--user-agent',
        'MyAgent',
        '--user',
        'alice:secret',
        '--cookie',
        'session=1',
        '--cookie',
        'pref=dark',
        '--compressed',
        '--insecure',
        '--cookie-file',
        cookieFile,
      ],
      { from: 'user' },
    );

    expect(launchMock).toHaveBeenCalledWith({ headless: true, args: ['--ignore-certificate-errors'] });
    expect(pageMocks.setViewport).toHaveBeenCalledWith({ width: 900, height: 900 });
    expect(pageMocks.waitForTimeout).toHaveBeenCalledWith(250);
    expect(pageMocks.setUserAgent).toHaveBeenCalledWith('MyAgent');
    expect(pageMocks.setExtraHTTPHeaders).toHaveBeenCalledWith(
      expect.objectContaining({
        'X-Test': '123',
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: 'session=1; pref=dark',
        'Accept-Encoding': 'gzip, deflate, br',
        Authorization: expect.stringMatching(/^Basic\s+/),
      }),
    );
    expect(pageMocks.authenticate).toHaveBeenCalledWith({ username: 'alice', password: 'secret' });
    expect(pageMocks.setCookie).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'foo',
        value: 'bar',
        domain: '.example.org',
      }),
    );
    expect(pageMocks.setRequestInterception).toHaveBeenNthCalledWith(1, true);
    expect(pageMocks.setRequestInterception).toHaveBeenLastCalledWith(false);

    expect(fakeRequest.continue).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PUT',
        postData: 'alpha=1&beta=2',
        headers: expect.objectContaining({
          existing: 'header',
          'X-Test': '123',
          Cookie: 'session=1; pref=dark',
        }),
      }),
    );

    const screenshotCall = pageMocks.screenshot.mock.calls[0][0];
    expect(path.dirname(screenshotCall.path)).toBe(screenshotDir);
    expect(path.basename(screenshotCall.path)).toMatch(/^bctx-browser /);

    logSpy.mockRestore();
  });

  it('rejects invalid width tokens', async () => {
    const command = createCommand();
    const { launchMock } = setupLaunchMock();

    await expect(
      command.parseAsync(['node', 'snap', 'https://example.com', '--width', 'tiny'], { from: 'user' }),
    ).rejects.toThrow('Invalid width');

    expect(launchMock).not.toHaveBeenCalled();
  });
});

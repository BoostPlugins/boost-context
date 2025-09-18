import { Command } from 'commander';
import puppeteer, {
  type Browser,
  type ContinueRequestOverrides,
  type HTTPRequest,
  type LaunchOptions,
  type Page,
} from 'puppeteer';
import { loadCookiesFromFile } from './cookies';
import { resolveOutputPath } from './output';
import { buildNetworkConfiguration, appendCliValue } from './request';
import { parseWaitOption, waitAfterLoad } from './timing';
import type { BrowserCommandOptions, NetworkConfiguration } from './types';
import { ensureAbsoluteUrl } from './url';
import { DEFAULT_VIEWPORT_HEIGHT, listTailwindKeys, resolveViewportWidth } from './viewport';

const setupNavigationOverrides = async (
  page: Page,
  network: NetworkConfiguration,
): Promise<void> => {
  await page.setRequestInterception(true);

  const handler = async (request: HTTPRequest): Promise<void> => {
    if (request.isNavigationRequest()) {
      const overrides: ContinueRequestOverrides = {};

      if (network.method && request.method().toUpperCase() !== network.method) {
        overrides.method = network.method;
      }

      if (network.postData !== undefined) {
        overrides.postData = network.postData;
      }

      if (Object.keys(network.headers).length > 0) {
        overrides.headers = { ...request.headers(), ...network.headers };
      }

      try {
        await request.continue(overrides);
      } catch {
        try {
          await request.abort();
        } catch {
          // Ignore abort errors.
        }
      } finally {
        page.off('request', handler);
        await page.setRequestInterception(false);
      }

      return;
    }

    try {
      await request.continue();
    } catch {
      try {
        await request.abort();
      } catch {
        // Ignore abort errors.
      }
    }
  };

  page.on('request', handler);
};

const launchBrowser = async (network: NetworkConfiguration): Promise<Browser> => {
  const launchOptions: LaunchOptions = { headless: true };

  if (network.launchArgs.length > 0) {
    launchOptions.args = network.launchArgs;
  }

  return puppeteer.launch(launchOptions);
};

export const buildSnapCommand = (): Command => {
  const command = new Command('snap');

  command
    .description('Generate a PNG snapshot of a webpage at a given Tailwind-style width')
    .argument('<url>', 'URL of the page to capture')
    .option('-w, --width <width>', `Viewport width in pixels or one of: ${listTailwindKeys()}`)
    .option('--wait <ms>', 'Wait this many milliseconds after load before capturing')
    .option('-o, --output <file>', 'Write the screenshot to this path (defaults to a generated name based on the URL)')
    .option('-H, --header <header>', 'Add a request header (repeatable).', appendCliValue, [])
    .option('-X, --request <method>', 'Specify the HTTP method to use for the initial navigation request.')
    .option('-d, --data <data>', 'Attach request body data (repeatable).', appendCliValue, [])
    .option('-A, --user-agent <userAgent>', 'Set the User-Agent header for the page.')
    .option('-u, --user <user:password>', 'Provide HTTP basic auth credentials.')
    .option('-b, --cookie <cookie>', 'Send a cookie (repeatable, format: name=value).', appendCliValue, [])
    .option('--cookie-file <path>', 'Load cookies from a Netscape/JSON export file before navigating.')
    .option('--compressed', 'Send an Accept-Encoding header for compressed content.')
    .option('-k, --insecure', 'Ignore TLS certificate errors when navigating.')
    .action(async (inputUrl: string, options: BrowserCommandOptions) => {
      const targetUrl = ensureAbsoluteUrl(inputUrl);
      const width = resolveViewportWidth(options.width);
      const waitMs = parseWaitOption(options.wait);
      const outputPath = resolveOutputPath(targetUrl, width, options.output);
      const network = buildNetworkConfiguration(options);

      const browser = await launchBrowser(network);
      try {
        const page = await browser.newPage();
        await page.setViewport({ width, height: DEFAULT_VIEWPORT_HEIGHT });

        if (network.userAgent) {
          await page.setUserAgent(network.userAgent);
        }

        if (Object.keys(network.headers).length > 0) {
          await page.setExtraHTTPHeaders(network.headers);
        }

        if (network.credentials) {
          await page.authenticate(network.credentials);
        }

        if (options.cookieFile) {
          const cookies = await loadCookiesFromFile(options.cookieFile, targetUrl);
          if (cookies.length > 0) {
            await page.setCookie(...cookies);
          }
        }

        if (network.shouldIntercept) {
          await setupNavigationOverrides(page, network);
        }

        await page.goto(targetUrl.toString(), { waitUntil: 'networkidle0' });
        await waitAfterLoad(page, waitMs);
        await page.screenshot({ path: outputPath, fullPage: true, type: 'png' });
        console.log(`Saved screenshot to ${outputPath}`);
      } finally {
        await browser.close();
      }
    });

  return command;
};

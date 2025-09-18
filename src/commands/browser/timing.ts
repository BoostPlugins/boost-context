import type { Page } from 'puppeteer';

export const parseWaitOption = (raw?: string): number => {
  if (!raw) {
    return 0;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
    throw new Error('Wait must be a non-negative integer representing milliseconds.');
  }

  return parsed;
};

export const waitAfterLoad = async (page: Page, waitMs: number): Promise<void> => {
  if (waitMs <= 0) {
    return;
  }

  const maybeWaitForTimeout = (page as unknown as {
    waitForTimeout?: (timeout: number) => Promise<void>;
  }).waitForTimeout;

  if (typeof maybeWaitForTimeout === 'function') {
    await maybeWaitForTimeout.call(page, waitMs);
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
};

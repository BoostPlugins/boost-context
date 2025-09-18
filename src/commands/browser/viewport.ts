const DEFAULT_TAILWIND_WIDTH_KEY = 'xl';

const TAILWIND_WIDTHS: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

export const DEFAULT_VIEWPORT_HEIGHT = 900;

export const listTailwindKeys = (): string => Object.keys(TAILWIND_WIDTHS).join(', ');

export const resolveViewportWidth = (raw?: string): number => {
  if (!raw) {
    return TAILWIND_WIDTHS[DEFAULT_TAILWIND_WIDTH_KEY];
  }

  const value = raw.trim().toLowerCase();
  if (value.length === 0) {
    return TAILWIND_WIDTHS[DEFAULT_TAILWIND_WIDTH_KEY];
  }

  if (value in TAILWIND_WIDTHS) {
    return TAILWIND_WIDTHS[value];
  }

  const numeric = value.endsWith('px') ? value.slice(0, -2).trim() : value;
  const parsed = Number.parseInt(numeric, 10);

  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid width "${raw}". Provide a positive number or one of: ${listTailwindKeys()}`,
    );
  }

  return parsed;
};

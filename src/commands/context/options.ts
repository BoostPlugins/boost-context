export const collectOption = (value: string, previous: string[] = []): string[] => {
  if (!value) {
    return previous;
  }

  const pieces = value
    .split(',')
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);

  if (pieces.length === 0) {
    return previous;
  }

  return [...previous, ...pieces];
};

export const parseExtensions = (rawExtensions: string[]): string[] => {
  if (!rawExtensions || rawExtensions.length === 0) {
    return [];
  }

  const unique = new Set<string>();

  for (const raw of rawExtensions) {
    const pieces = raw.split('|');
    for (const piece of pieces) {
      const trimmed = piece.trim().replace(/^\./, '');
      if (trimmed.length > 0) {
        unique.add(trimmed);
      }
    }
  }

  return Array.from(unique);
};

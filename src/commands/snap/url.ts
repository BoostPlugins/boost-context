export const ensureAbsoluteUrl = (input: string): URL => {
  try {
    return new URL(input);
  } catch {
    try {
      return new URL(`https://${input}`);
    } catch {
      throw new Error(`Invalid URL "${input}". Provide a fully qualified URL such as https://example.com`);
    }
  }
};

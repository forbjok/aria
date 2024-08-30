export function tryParseJson(json: string | null, defaultValue: any) {
  if (!json) {
    return defaultValue;
  }

  try {
    return JSON.parse(json);
  } catch {
    return defaultValue;
  }
}

export function getEnvOrThrow(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Env variable ${name} is not set or empty`);
  }
  return value;
}

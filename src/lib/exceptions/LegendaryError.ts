export default class LegendaryError extends Error {
  constructor(stdout: string) {
    super();
    this.name = 'LegendaryError';
    this.message = stdout.trim();
  }
}

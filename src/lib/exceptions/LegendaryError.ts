export default class LegendaryError extends Error {
  constructor(message: string) {
    super();
    this.name = 'LegendaryError';
    this.message = message.trim();
  }
}

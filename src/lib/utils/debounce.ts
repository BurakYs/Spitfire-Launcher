export default function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: number | null = null;
  let resolvePromise: ((value: Awaited<ReturnType<T>>) => void) | null = null;
  let rejectPromise: ((reason?: any) => void) | null = null;

  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (resolvePromise) {
        resolvePromise = resolve;
        rejectPromise = reject;
      } else {
        resolvePromise = resolve;
        rejectPromise = reject;
      }

      timeoutId = window.setTimeout(async () => {
        try {
          const result = await fn(...args);

          if (resolvePromise) {
            resolvePromise(result);
            resolvePromise = null;
            rejectPromise = null;
          }
        } catch (error) {
          if (rejectPromise) {
            rejectPromise(error);
            resolvePromise = null;
            rejectPromise = null;
          }
        }

        timeoutId = null;
      }, delay);
    });
  };
}
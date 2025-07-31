export default function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  let timeoutId: number | null = null;
  let pendingPromises: Array<{
    resolve: (value: Awaited<ReturnType<T>>) => void;
    reject: (reason?: any) => void;
  }> = [];

  return (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      pendingPromises.push({ resolve, reject });

      timeoutId = window.setTimeout(async () => {
        try {
          const result = await fn(...args);

          for (const promise of pendingPromises) {
            promise.resolve(result);
          }
        } catch (error) {
          for (const promise of pendingPromises) {
            promise.reject(error);
          }
        }

        pendingPromises = [];
        timeoutId = null;
      }, delay);
    });
  };
}
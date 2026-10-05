export function once<T>(factory: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= factory().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

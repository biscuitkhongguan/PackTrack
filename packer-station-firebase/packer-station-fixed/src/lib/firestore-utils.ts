/**
 * Recursively removes undefined values from an object.
 * Firestore does not support undefined values in documents.
 */
export function sanitizeFirestoreData<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) return data.map(sanitizeFirestoreData) as unknown as T;
  if (typeof data === 'object') {
    const result: any = {};
    for (const key in data as object) {
      const value = (data as any)[key];
      if (value !== undefined) result[key] = sanitizeFirestoreData(value);
    }
    return result;
  }
  return data;
}

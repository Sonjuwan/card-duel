/** Speculative game state consists of plain records, arrays and primitives.
 * Retain shared references and undefined fields without cloning card data. */
export function copySimulationData<T>(data: T): T {
  const seen = new Map<object, unknown>();
  function copy(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    const known = seen.get(value);
    if (known !== undefined) return known;
    if (Array.isArray(value)) {
      const result: unknown[] = new Array(value.length);
      seen.set(value, result);
      for (let i = 0; i < value.length; i++) {
        if (i in value) result[i] = copy(value[i]);
      }
      return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('Non-plain simulation state');
    const result: Record<string, unknown> = {};
    seen.set(value, result);
    for (const key of Object.keys(value)) {
      const child = copy((value as Record<string, unknown>)[key]);
      if (key === '__proto__') Object.defineProperty(result, key, { value: child, writable: true, enumerable: true, configurable: true });
      else result[key] = child;
    }
    return result;
  }
  return copy(data) as T;
}

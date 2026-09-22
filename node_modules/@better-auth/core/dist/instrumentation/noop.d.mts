//#region src/instrumentation/noop.d.ts
/**
 * Executes a function without creating an OpenTelemetry span.
 */
declare function noopWithSpan<T>(name: string, attributes: Record<string, string | number | boolean>, fn: () => T): T;
declare function noopWithSpan<T>(name: string, attributes: Record<string, string | number | boolean>, fn: () => Promise<T>): Promise<T>;
//#endregion
export { noopWithSpan };
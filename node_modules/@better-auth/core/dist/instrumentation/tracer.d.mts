import { BetterAuthOptions } from "../types/init-options.mjs";
//#region src/instrumentation/tracer.d.ts
/**
 * Creates a child span whose lifetime is bound to the execution of the given function
 *
 * @param name - The name of the span.
 * @param attributes - The attributes of the span.
 * @param fn - The function to execute within the span.
 * @returns The result of the function.
 */
declare function withSpan<T>(name: string, attributes: Record<string, string | number | boolean>, fn: () => T): T;
declare function withSpan<T>(name: string, attributes: Record<string, string | number | boolean>, fn: () => Promise<T>): Promise<T>;
/**
 * Selects the span runner for an auth instance.
 */
declare function createWithSpan(options: BetterAuthOptions): typeof withSpan;
//#endregion
export { createWithSpan, withSpan };
import { ATTR_CONTEXT, ATTR_DB_COLLECTION_NAME, ATTR_DB_OPERATION_NAME, ATTR_HOOK_TYPE, ATTR_HTTP_RESPONSE_STATUS_CODE, ATTR_HTTP_ROUTE, ATTR_OPERATION_ID } from "./attributes.mjs";
import { noopWithSpan } from "./noop.mjs";
//#region src/instrumentation/pure.index.ts
/**
* Selects the span runner for an auth instance.
*/
function createWithSpan(_options) {
	return noopWithSpan;
}
//#endregion
export { ATTR_CONTEXT, ATTR_DB_COLLECTION_NAME, ATTR_DB_OPERATION_NAME, ATTR_HOOK_TYPE, ATTR_HTTP_RESPONSE_STATUS_CODE, ATTR_HTTP_ROUTE, ATTR_OPERATION_ID, createWithSpan, noopWithSpan as withSpan };

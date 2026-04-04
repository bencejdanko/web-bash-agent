/**
 * Stub for node:zlib in browser environments.
 * just-bash's browser bundle imports zlib for tar/gzip commands,
 * but we don't need those in the site explorer use case.
 * If called, they throw a clear error instead of crashing at import time.
 */

export const constants = {
  Z_BEST_COMPRESSION: 9,
  Z_BEST_SPEED: 1,
  Z_DEFAULT_COMPRESSION: -1,
};

export function gunzipSync() {
  throw new Error('gzip/gunzip is not available in browser environments');
}

export function gzipSync() {
  throw new Error('gzip is not available in browser environments');
}

export default { constants, gunzipSync, gzipSync };

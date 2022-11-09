import { run } from '@oclif/core';

/**
 * Invokes the `testcli-modern` CLI with args programmatically.
 *
 * @param {...string} args - args to pass to CLI.
 *
 * @returns {Promise<void>}
 */
export default async function ship(...args: any[]) {
  return run(args, import.meta.url);
}

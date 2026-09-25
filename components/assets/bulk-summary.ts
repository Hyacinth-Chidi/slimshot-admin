/**
 * Turns Promise.allSettled results from a bulk publish/unpublish/delete into
 * the one-line toast spec'd for the bulk bar: "3 published, 1 failed:
 * <message>" — the first failure's message is the actionable part, not a
 * stack of every failure.
 */
export function summarizeBulkResult(
  verb: 'published' | 'unpublished' | 'deleted',
  results: PromiseSettledResult<unknown>[],
): string {
  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  );

  if (failures.length === 0) {
    return `${succeeded} ${verb}.`;
  }

  const firstMessage =
    failures[0].reason instanceof Error ? failures[0].reason.message : String(failures[0].reason);

  return `${succeeded} ${verb}, ${failures.length} failed: ${firstMessage}`;
}

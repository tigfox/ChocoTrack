import type { GraphqlClient } from './client';

export interface RecordedCall {
  readonly query: string;
  readonly variables: Readonly<Record<string, unknown>> | undefined;
}

/** Test double: answers with queued responses in order and records every call. */
export const fakeClient = (...responses: readonly unknown[]): GraphqlClient & { calls: RecordedCall[] } => {
  const calls: RecordedCall[] = [];
  const queue = [...responses];
  const client = (async (query: string, variables?: Readonly<Record<string, unknown>>) => {
    calls.push({ query, variables });
    if (queue.length === 0) throw new Error('fakeClient: no response queued');
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next;
  }) as GraphqlClient & { calls: RecordedCall[] };
  client.calls = calls;
  return client;
};

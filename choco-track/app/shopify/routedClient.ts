import type { GraphqlClient } from './client';
import type { RecordedCall } from './fakeClient';

type Reply = unknown | ((variables: Readonly<Record<string, unknown>> | undefined) => unknown);

/**
 * Test double for code that makes several reads in parallel: answers by matching a fragment of the query text,
 * so the result does not depend on the order the calls happen in. Records every call.
 */
export const routedClient = (routes: Readonly<Record<string, Reply>>): GraphqlClient & { calls: RecordedCall[] } => {
  const calls: RecordedCall[] = [];
  const client = (async (query: string, variables?: Readonly<Record<string, unknown>>) => {
    calls.push({ query, variables });
    const key = Object.keys(routes).find((fragment) => query.includes(fragment));
    if (key === undefined) throw new Error(`routedClient: no route for ${query.slice(0, 80)}`);
    const reply = routes[key];
    const value = typeof reply === 'function' ? (reply as (v: typeof variables) => unknown)(variables) : reply;
    if (value instanceof Error) throw value;
    return value;
  }) as GraphqlClient & { calls: RecordedCall[] };
  client.calls = calls;
  return client;
};

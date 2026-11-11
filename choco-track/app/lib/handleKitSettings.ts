import type { GraphqlClient } from '../shopify/client';
import { friendlyMessage } from '../shopify/errors';
import { createKit, updateKit } from '../shopify/kits';
import { parseKitUpdate } from './kitUpdateInput';
import { logError } from './logError';
import { parseNewKit } from './newKitInput';

export type SettingsResponse = { readonly ok: true; readonly message: string } | { readonly ok: false; readonly message: string };

const fail = (message: string): SettingsResponse => ({ ok: false, message });

/** Creates or edits a kit from the Settings page. The body is untrusted JSON. */
export const handleKitSettings = async (client: GraphqlClient, raw: unknown): Promise<SettingsResponse> => {
  const intent = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>).intent : undefined;
  try {
    if (intent === 'create') {
      const parsed = parseNewKit(raw);
      if (!parsed.ok) return fail(parsed.error);
      await createKit(client, parsed.value);
      return { ok: true, message: `Created ${parsed.value.title}.` };
    }
    if (intent === 'update') {
      const parsed = parseKitUpdate(raw);
      if (!parsed.ok) return fail(parsed.error);
      await updateKit(client, parsed.value);
      return { ok: true, message: `Saved ${parsed.value.title}.` };
    }
    return fail('Invalid request.');
  } catch (err) {
    logError('kit settings failed', err, { intent });
    return fail(friendlyMessage(err));
  }
};

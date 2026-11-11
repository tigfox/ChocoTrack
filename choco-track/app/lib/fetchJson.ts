export const NETWORK_MESSAGE = "Couldn't reach the app. Check your connection and try again.";

export type FetchResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly message: string };

const failure = (message: string): FetchResult<never> => ({ ok: false, message });

/**
 * JSON over fetch that never throws. A dropped connection must show a message next to the person's work;
 * letting it escape would replace the whole page with an error screen. Pass a body to POST it as JSON.
 */
export const fetchJson = async <T>(url: string, body?: unknown): Promise<FetchResult<T>> => {
  let response: Response;
  try {
    response = await fetch(
      url,
      body === undefined
        ? { method: 'GET' }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
  } catch {
    return failure(NETWORK_MESSAGE);
  }
  if (response.status === 401 || response.status === 403) return failure('Your session expired. Reload the page and try again.');
  if (!response.ok) return failure(`The app returned an error (${response.status}). Reload the page and try again.`);
  try {
    return { ok: true, data: (await response.json()) as T };
  } catch {
    return failure('The app sent an unexpected response. Reload the page and try again.');
  }
};

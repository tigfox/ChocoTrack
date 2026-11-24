import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

import styles from "./styles.module.css";

// Shopify sends installs and admin opens to "/?shop=...": hand those to the app.
// A plain visit gets a blank dark-brown page: no text, no login form, nothing to find.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function Index() {
  return <div className={styles.index} />;
}

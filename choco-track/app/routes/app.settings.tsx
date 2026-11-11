import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { KitSettingsView } from "../components/KitSettingsView";
import { fromAdmin } from "../shopify/client";
import { loadWorkspace } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return loadWorkspace(fromAdmin(admin));
};

export default function Settings() {
  return <KitSettingsView workspace={useLoaderData<typeof loader>()} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

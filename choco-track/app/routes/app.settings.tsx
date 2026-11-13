import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { KitSettingsView } from "../components/KitSettingsView";
import { fromAdmin } from "../shopify/client";
import { loadSourceIds } from "../shopify/trackedCatalog";
import { loadWorkspace } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const client = fromAdmin(admin);
  const [workspace, sourceIds] = await Promise.all([loadWorkspace(client), loadSourceIds(client).catch(() => [] as readonly string[])]);
  return { ...workspace, sourceIds };
};

export default function Settings() {
  const { sourceIds, ...workspace } = useLoaderData<typeof loader>();
  return <KitSettingsView workspace={workspace} sourceIds={sourceIds} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

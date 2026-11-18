import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { KitSettingsView } from "../components/KitSettingsView";
import { fromAdmin } from "../shopify/client";
import { DEFAULT_MULTIPLES } from "../domain/multiples";
import { loadTransferSettings } from "../shopify/trackedCatalog";
import { loadWorkspace } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const client = fromAdmin(admin);
  const [workspace, transfer] = await Promise.all([
    loadWorkspace(client),
    loadTransferSettings(client).catch(() => ({ sourceIds: [] as readonly string[], multiples: DEFAULT_MULTIPLES })),
  ]);
  return { ...workspace, ...transfer };
};

export default function Settings() {
  const { sourceIds, multiples, ...workspace } = useLoaderData<typeof loader>();
  return <KitSettingsView workspace={workspace} sourceIds={sourceIds} multiples={multiples} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

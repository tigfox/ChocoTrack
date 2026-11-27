import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { KitSettingsView } from "../components/KitSettingsView";
import { fromAdmin } from "../shopify/client";
import { DEFAULT_PACK_SIZES } from "../domain/packSizes";
import { loadTransferSettings } from "../shopify/trackedCatalog";
import { loadVariantLabels } from "../shopify/variantLabels";
import { loadWorkspace } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const client = fromAdmin(admin);
  const [workspace, transfer] = await Promise.all([
    loadWorkspace(client),
    loadTransferSettings(client).catch(() => ({ sourceIds: [] as readonly string[], packSizes: DEFAULT_PACK_SIZES })),
  ]);
  // Groups store variant ids; the card shows names, so look them up (a failure only costs the names).
  const labels = await loadVariantLabels(client, transfer.packSizes.groups.flatMap((g) => g.variantIds)).catch(() => ({}));
  return { ...workspace, ...transfer, labels };
};

export default function Settings() {
  const { sourceIds, packSizes, labels, ...workspace } = useLoaderData<typeof loader>();
  const { revalidate } = useRevalidator();
  return <KitSettingsView workspace={workspace} sourceIds={sourceIds} packSizes={packSizes} labels={labels} onSettingsReset={() => revalidate()} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

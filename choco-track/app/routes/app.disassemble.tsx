import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { KitRunView } from "../components/KitRunView";
import { fromAdmin } from "../shopify/client";
import { loadWorkspace } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return loadWorkspace(fromAdmin(admin));
};

export default function Disassemble() {
  return <KitRunView workspace={useLoaderData<typeof loader>()} mode="disassemble" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

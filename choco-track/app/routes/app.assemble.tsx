import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { KitRunView } from "../components/KitRunView";
import { handleRun } from "../lib/handleRun";
import { readJsonBody } from "../lib/readJsonBody";
import { fromAdmin } from "../shopify/client";
import { loadWorkspace } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return loadWorkspace(fromAdmin(admin));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return handleRun(fromAdmin(admin), await readJsonBody(request), "assemble");
};

export default function Assemble() {
  return <KitRunView workspace={useLoaderData<typeof loader>()} mode="assemble" />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

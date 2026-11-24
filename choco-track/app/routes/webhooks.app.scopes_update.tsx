import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { parseScopes } from "../lib/parseScopes";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const scope = parseScopes(payload);
  if (scope === null) {
    // Acknowledge so Shopify does not retry a payload we can never use.
    console.error(`Ignoring ${topic} webhook for ${shop}: unexpected payload shape`);
    return new Response();
  }
  if (session) {
    await db.session.update({ where: { id: session.id }, data: { scope } });
  }
  return new Response();
};

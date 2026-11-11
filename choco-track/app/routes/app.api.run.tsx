import type { ActionFunctionArgs } from "react-router";
import { handleRun } from "../lib/handleRun";
import { readJsonBody } from "../lib/readJsonBody";
import { fromAdmin } from "../shopify/client";
import { authenticate } from "../shopify.server";

/** Assemble or disassemble: `POST /app/api/run?mode=assemble|disassemble` with a JSON body. Always answers JSON. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "assemble" && mode !== "disassemble") {
    return Response.json({ result: { ok: false, kind: "error", message: "Invalid request." } });
  }
  return Response.json(await handleRun(fromAdmin(admin), await readJsonBody(request), mode));
};

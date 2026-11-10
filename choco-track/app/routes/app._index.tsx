import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

export default function Index() {
  return (
    <s-page heading="ChocoTrack">
      <s-section heading="Sampler Builder">
        <s-paragraph>Assemble and disassemble sampler kits from your mini bar inventory.</s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);

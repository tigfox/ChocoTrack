import type { Location } from "../domain/types";
import type { CreatedTransfer } from "../lib/handleInventory";
import { transferListUrl, transferUrl } from "../lib/transferLinks";

interface Props {
  readonly created: readonly CreatedTransfer[];
  readonly locations: readonly Location[];
  /** The store name, from the session. Without it no links are shown. */
  readonly shopHandle: string | undefined;
}

/** Where to find the drafts that were just created, so a person can review them and mark them ready. */
export function CreatedTransferLinks({ created, locations, shopHandle }: Props) {
  if (created.length === 0) return null;
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const list = transferListUrl(shopHandle);
  return (
    <s-section heading="Draft transfers created">
      <s-stack gap="small-200">
        {created.map((t) => {
          const route = `${nameOf(t.originId)} to ${nameOf(t.destinationId)}`;
          const href = transferUrl(shopHandle, t.id);
          return href ? (
            <s-link key={t.id} href={href} target="_blank">{`Open draft: ${route}`}</s-link>
          ) : (
            <s-text key={t.id}>{route}</s-text>
          );
        })}
        {list && <s-link href={list} target="_blank">All transfers in Shopify</s-link>}
      </s-stack>
    </s-section>
  );
}

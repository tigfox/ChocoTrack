import type { Collection, Location, StockMap } from '../domain/types';
import { listCollections, listKits, type CatalogVariant } from './catalog';
import type { GraphqlClient } from './client';
import { listLocations } from './locations';

export interface Workspace {
  readonly locations: readonly Location[];
  readonly collections: readonly Collection[];
  readonly kits: readonly CatalogVariant[];
  /** Stock for the kits at every location. */
  readonly stock: StockMap;
}

/** Everything the screens need to start, in a single round trip (the three reads run in parallel). */
export const loadWorkspace = async (client: GraphqlClient): Promise<Workspace> => {
  const [locations, collections, kits] = await Promise.all([listLocations(client), listCollections(client), listKits(client)]);
  return { locations, collections, kits: kits.variants, stock: kits.stock };
};

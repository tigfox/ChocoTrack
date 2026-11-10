import type { Collection, Location, StockMap } from '../domain/types';
import { listCollections, listKits, searchVariants, type CatalogVariant, type SearchOptions } from './catalog';
import type { GraphqlClient } from './client';
import { loadStock } from './inventory';
import { listLocations } from './locations';

export interface Workspace {
  readonly locations: readonly Location[];
  readonly collections: readonly Collection[];
  readonly kits: readonly CatalogVariant[];
  /** Stock for the kits at every location. */
  readonly stock: StockMap;
}

export const loadWorkspace = async (client: GraphqlClient): Promise<Workspace> => {
  const [locations, collections, kits] = await Promise.all([listLocations(client), listCollections(client), listKits(client)]);
  const stock = await loadStock(client, kits.map((k) => k.id));
  return { locations, collections, kits, stock };
};

export interface SearchResult {
  readonly variants: readonly CatalogVariant[];
  readonly stock: StockMap;
}

export const searchWithStock = async (client: GraphqlClient, options: SearchOptions): Promise<SearchResult> => {
  const variants = await searchVariants(client, options);
  const stock = await loadStock(client, variants.map((v) => v.id));
  return { variants, stock };
};

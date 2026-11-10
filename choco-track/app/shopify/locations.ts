import type { Location } from '../domain/types';
import type { GraphqlClient } from './client';

const LOCATIONS_QUERY = `#graphql
  query Locations { locations(first: 50) { nodes { id name isActive } } }
`;

interface LocationsData {
  locations: { nodes: ReadonlyArray<{ id: string; name: string; isActive: boolean }> };
}

export const listLocations = async (client: GraphqlClient): Promise<readonly Location[]> => {
  const data = await client<LocationsData>(LOCATIONS_QUERY);
  return data.locations.nodes.filter((l) => l.isActive).map(({ id, name }) => ({ id, name }));
};

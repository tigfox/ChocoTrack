import { fakeClient } from './fakeClient';
import { listLocations } from './locations';

it('lists only active locations', async () => {
  const client = fakeClient({
    locations: { nodes: [{ id: 'l1', name: 'Warehouse', isActive: true }, { id: 'l2', name: 'Old', isActive: false }] },
  });
  await expect(listLocations(client)).resolves.toEqual([{ id: 'l1', name: 'Warehouse' }]);
});

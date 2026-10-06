/**
 * The climate answer bundled with the app: what the page shows when a publisher is down or the
 * device is offline. `snapshot.json` is a real answer of /api/climate saved to disk, never typed
 * by hand. To refresh it, open /api/climate on a running server, check that every reading says
 * "live", and save the body over the file. Whatever its readings said then, here they are all
 * snapshots.
 */
import { SIGNAL_IDS, type ClimatePayload } from './contract';
import raw from './snapshot.json';
import { parseClimatePayload } from './validate';

function load(): ClimatePayload {
  const parsed = parseClimatePayload(raw);
  if (!parsed) throw new Error('server/climate/snapshot.json is not a valid climate payload');
  const frozen: ClimatePayload = { ...parsed };
  for (const id of SIGNAL_IDS) frozen[id].status = 'snapshot';
  return frozen;
}

export const CLIMATE_SNAPSHOT: ClimatePayload = load();

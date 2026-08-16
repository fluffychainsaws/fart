import { describe, expect, it } from 'vitest';
import { belongsToCampaign, keys } from './keys';
import { assertCampaignId } from './scoped';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('cache keys', () => {
  it('never lets two campaigns share a key', () => {
    const forA = [keys.members(A), keys.invites(A), keys.notes(A), keys.characters(A)];
    const forB = [keys.members(B), keys.invites(B), keys.notes(B), keys.characters(B)];

    const serialise = (k: readonly unknown[]) => JSON.stringify(k);
    const overlap = forA.map(serialise).filter((k) => forB.map(serialise).includes(k));
    expect(overlap).toEqual([]);
  });

  it('puts the campaign id where a bulk purge can find it', () => {
    for (const key of [keys.members(A), keys.invites(A), keys.aiThreads(A)]) {
      expect(belongsToCampaign(key, A)).toBe(true);
      expect(belongsToCampaign(key, B)).toBe(false);
    }
  });

  it('keeps cross-campaign keys out of the campaign namespace', () => {
    // The hub and the invite preview are the only screens that exist outside a
    // campaign; if they used a ['campaign', ...] key they would be purged on
    // every campaign switch — and worse, they'd imply a scope they don't have.
    expect(keys.myCampaigns()[0]).not.toBe('campaign');
    expect(keys.invitePreview('ABC123')[0]).not.toBe('campaign');
  });
});

describe('assertCampaignId', () => {
  it('accepts a uuid', () => {
    expect(() => assertCampaignId(A)).not.toThrow();
  });

  it('refuses anything that is not one', () => {
    for (const bad of ['', undefined, null, 'undefined', 'all', '../', '1']) {
      expect(() => assertCampaignId(bad as string | undefined)).toThrow();
    }
  });
});

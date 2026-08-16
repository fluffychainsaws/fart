import { describe, expect, it } from 'vitest';
import { ROLES, can, type Capability, type Role, type Viewer } from './roles';

const viewer = (role: Role, isOwner = false): Viewer => ({ role, isOwner });

describe('capabilities', () => {
  it('gives a DM the run of their campaign', () => {
    const dm = viewer('dm');
    expect(can(dm, 'campaign.edit')).toBe(true);
    expect(can(dm, 'invites.create')).toBe(true);
    expect(can(dm, 'members.manageRoles')).toBe(true);
    expect(can(dm, 'lore.viewDmOnly')).toBe(true);
  });

  it('keeps owner-only powers away from a non-owner DM', () => {
    const coDm = viewer('dm', false);
    const owner = viewer('dm', true);

    for (const capability of ['campaign.delete', 'campaign.transfer', 'invites.createDm'] as const) {
      expect(can(coDm, capability)).toBe(false);
      expect(can(owner, capability)).toBe(true);
    }
  });

  it('lets players play but not administer', () => {
    const player = viewer('player');
    expect(can(player, 'characters.create')).toBe(true);
    expect(can(player, 'notes.create')).toBe(true);
    expect(can(player, 'invites.create')).toBe(false);
    expect(can(player, 'members.manageRoles')).toBe(false);
    expect(can(player, 'lore.viewDmOnly')).toBe(false);
    expect(can(player, 'ai.dmPerspective')).toBe(false);
  });

  it('keeps observers read-only apart from their own notes', () => {
    const observer = viewer('observer');
    expect(can(observer, 'notes.create')).toBe(true);
    expect(can(observer, 'characters.create')).toBe(false);
    expect(can(observer, 'campaign.edit')).toBe(false);
  });

  it('grants nothing at all without a viewer', () => {
    // A signed-in user who is not a member of the campaign has no role in it.
    // Every capability must fail closed for them.
    const capabilities: Capability[] = [
      'campaign.edit',
      'campaign.delete',
      'invites.create',
      'characters.create',
      'notes.create',
      'lore.viewDmOnly',
      'ai.dmPerspective',
    ];
    for (const capability of capabilities) {
      expect(can(null, capability)).toBe(false);
      expect(can(undefined, capability)).toBe(false);
    }
  });

  it('lets anyone leave, since leaving is not a privilege', () => {
    for (const role of ROLES) {
      expect(can(viewer(role), 'members.leave')).toBe(true);
    }
  });
});

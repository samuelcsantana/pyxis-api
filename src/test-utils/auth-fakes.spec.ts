import type { Project } from '../domain/entities/project.entity';
import { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';
import { InMemoryOtpCodeRepository } from './in-memory-otp-code.repository';
import { InMemoryReviewerCodeRepository } from './in-memory-reviewer-code.repository';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  cityEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

describe('InMemoryAdminUserRepository', () => {
  it('grants access once, creating the admin the first time, and lists only known projects', async () => {
    const admins = new InMemoryAdminUserRepository();
    admins.addProject(PROJECT);

    const first = await admins.grantAccess('ana@example.com', PROJECT.id);
    const again = await admins.grantAccess('ana@example.com', PROJECT.id);
    await admins.grantAccess('ana@example.com', 'missing-project');

    expect(again).toEqual(first);
    expect(await admins.projectsOf(first.id)).toEqual([PROJECT]);
    expect(await admins.findById(first.id)).toEqual(first);
    expect(await admins.findById('nobody')).toBeNull();
  });

  it('finds a granted project and nothing else', async () => {
    const admins = new InMemoryAdminUserRepository();
    admins.addProject(PROJECT);
    const admin = await admins.grantAccess('ana@example.com', PROJECT.id);

    expect(await admins.accessibleProject(admin.id, PROJECT.id)).toEqual(PROJECT);
    expect(await admins.accessibleProject(admin.id, 'other-project')).toBeNull();
    expect(await admins.accessibleProject('stranger', PROJECT.id)).toBeNull();
  });

  it('suspends and resumes a known admin only', async () => {
    const admins = new InMemoryAdminUserRepository();
    const ana = await admins.findOrCreateByEmail('ana@example.com');
    const at = new Date('2026-11-03T12:00:00.000Z');

    expect(await admins.suspend(ana.id, at)).toMatchObject({ suspendedAt: at });
    expect(await admins.resume(ana.id)).toMatchObject({ suspendedAt: null });
    expect(await admins.suspend('nobody', at)).toBeNull();
    expect(await admins.resume('nobody')).toBeNull();
  });

  it('changes the language of one admin only', async () => {
    const admins = new InMemoryAdminUserRepository();
    const ana = await admins.grantAccess('ana@example.com', PROJECT.id);
    const bruno = await admins.grantAccess('bruno@example.com', PROJECT.id);

    await admins.setEmailLanguage(ana.id, 'pt-BR');

    expect(await admins.findById(ana.id)).toEqual({ ...ana, emailLanguage: 'pt-BR' });
    expect(await admins.findById(bruno.id)).toEqual(bruno);
  });
});

describe('InMemoryOtpCodeRepository', () => {
  it('ignores an unknown code', async () => {
    const codes = new InMemoryOtpCodeRepository();

    expect(await codes.consumeAttempt('missing', 5)).toBe(false);
    expect(await codes.claim('missing', new Date())).toBe(false);
  });

  it('counts and finds codes by their purpose', async () => {
    const codes = new InMemoryOtpCodeRepository();
    const now = new Date('2026-11-02T13:00:00.000Z');
    const later = new Date('2026-11-02T13:10:00.000Z');
    const signUp = await codes.create({
      email: 'ana@example.com',
      codeHash: 'up',
      emailLanguage: 'en',
      purpose: 'sign_up',
      createdAt: now,
      expiresAt: later,
    });
    await codes.create({
      email: 'bia@example.com',
      codeHash: 'in',
      emailLanguage: 'en',
      purpose: 'sign_in',
      createdAt: now,
      expiresAt: later,
    });

    expect(await codes.countPurposeSince('sign_up', now)).toBe(1);
    expect(await codes.countPurposeSince('sign_up', later)).toBe(0);
    expect(await codes.findLatestValid('ana@example.com', now, 'sign_up')).toEqual(
      expect.objectContaining({ id: signUp.id }),
    );
    expect(await codes.findLatestValid('ana@example.com', now, 'sign_in')).toBeNull();
  });
});

describe('InMemoryReviewerCodeRepository', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');
  const later = new Date('2027-10-20T12:00:00.000Z');

  it('reserves attempts while the code lives and is under the cap, never releasing below zero', async () => {
    const codes = new InMemoryReviewerCodeRepository();
    await codes.open({ adminUserId: 'ana', codeHash: 'a', createdAt: now, expiresAt: later });

    await codes.releaseAttempt('ana');
    const first = await codes.reserveAttempt('ana', now, 1);
    const overTheCap = await codes.reserveAttempt('ana', now, 1);

    expect((await codes.findLive('ana', now))?.failedAttempts).toBe(1);
    expect(first?.failedAttempts).toBe(1);
    expect(overTheCap).toBeNull();
    expect(await codes.reserveAttempt('ana', later, 5)).toBeNull();
    expect(await codes.findLive('ana', later)).toBeNull();
  });

  it('ignores an unknown admin and closes a code once', async () => {
    const codes = new InMemoryReviewerCodeRepository();
    await codes.open({ adminUserId: 'ana', codeHash: 'a', createdAt: now, expiresAt: later });

    await codes.releaseAttempt('nobody');

    expect(await codes.reserveAttempt('nobody', now, 5)).toBeNull();
    expect(await codes.findLive('nobody', now)).toBeNull();
    expect(await codes.close('ana')).toBe(true);
    expect(await codes.close('ana')).toBe(false);
  });
});

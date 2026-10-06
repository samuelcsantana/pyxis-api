import type { Project } from '../domain/entities/project.entity';
import { InMemoryAdminUserRepository } from './in-memory-admin-user.repository';
import { InMemoryOtpCodeRepository } from './in-memory-otp-code.repository';

const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
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
});

describe('InMemoryOtpCodeRepository', () => {
  it('ignores an unknown code', async () => {
    const codes = new InMemoryOtpCodeRepository();

    expect(await codes.consumeAttempt('missing', 5)).toBe(false);
    expect(await codes.claim('missing', new Date())).toBe(false);
  });
});

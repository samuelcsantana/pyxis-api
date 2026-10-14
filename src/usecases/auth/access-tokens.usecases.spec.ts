import { Logger } from '@nestjs/common';
import {
  ACCESS_TOKEN_PATTERN,
  ACCESS_TOKEN_TOUCH_INTERVAL_MS,
  MAX_LIVE_ACCESS_TOKENS,
} from '../../domain/auth/access-token-policy';
import { sha256Hex } from '../../domain/auth/hashing';
import type { AdminUser } from '../../domain/entities/admin-user.entity';
import {
  AccessTokenNotFoundError,
  TooManyAccessTokensError,
  UnauthenticatedError,
} from '../../domain/errors/auth.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAccessTokenRepository } from '../../test-utils/in-memory-access-token.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { AuthenticateAccessTokenUseCase } from './authenticate-access-token.usecase';
import { CreateAccessTokenUseCase } from './create-access-token.usecase';
import { ListAccessTokensUseCase } from './list-access-tokens.usecase';
import { RevokeAccessTokenUseCase } from './revoke-access-token.usecase';

const NOW = new Date('2026-10-14T12:00:00.000Z');
const DAY_MS = 86_400_000;

async function setup() {
  const tokens = new InMemoryAccessTokenRepository();
  const admins = new InMemoryAdminUserRepository();
  const clock = new FixedClock(NOW);
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const ana = await admins.grantAccess('ana@example.com', 'project-1');
  const bruno = await admins.grantAccess('bruno@example.com', 'project-1');
  return {
    tokens,
    admins,
    clock,
    ana,
    bruno,
    create: new CreateAccessTokenUseCase(tokens, random, clock),
    list: new ListAccessTokensUseCase(tokens, clock),
    revoke: new RevokeAccessTokenUseCase(tokens, clock),
    authenticate: new AuthenticateAccessTokenUseCase(tokens, admins, clock),
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('CreateAccessTokenUseCase', () => {
  it('answers the token once and keeps only its hash, with the expiry asked for', async () => {
    const { tokens, create, ana } = await setup();

    const created = await create.execute(ana, { name: 'Claude Code', lifetimeDays: 30 });

    expect(created.secret).toMatch(ACCESS_TOKEN_PATTERN);
    expect(created.token).toEqual({
      id: expect.any(String) as string,
      adminUserId: ana.id,
      name: 'Claude Code',
      createdAt: NOW,
      lastUsedAt: null,
      expiresAt: new Date(NOW.getTime() + 30 * DAY_MS),
    });
    expect(tokens.stored[0]?.tokenHash).toBe(sha256Hex(created.secret));
    expect(JSON.stringify(tokens.stored)).not.toContain(created.secret);
  });

  it('logs the admin and the token ids, never the token', async () => {
    const { create, ana } = await setup();
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    const created = await create.execute(ana, { name: 'Cursor', lifetimeDays: 90 });

    expect(logs).toEqual([
      { message: 'auth.access_token_created', adminUserId: ana.id, tokenId: created.token.id },
    ]);
  });

  it('refuses an eleventh live token, counting only the admin asking', async () => {
    const { create, ana, bruno } = await setup();
    for (let index = 0; index < MAX_LIVE_ACCESS_TOKENS; index += 1) {
      await create.execute(ana, { name: `agent ${String(index)}`, lifetimeDays: 30 });
    }

    await expect(
      create.execute(ana, { name: 'one too many', lifetimeDays: 30 }),
    ).rejects.toBeInstanceOf(TooManyAccessTokensError);
    await expect(
      create.execute(bruno, { name: 'his own', lifetimeDays: 30 }),
    ).resolves.toBeDefined();
  });

  it('counts only live tokens toward the limit', async () => {
    const { create, revoke, ana } = await setup();
    const created = [];
    for (let index = 0; index < MAX_LIVE_ACCESS_TOKENS; index += 1) {
      created.push(await create.execute(ana, { name: `agent ${String(index)}`, lifetimeDays: 30 }));
    }
    await revoke.execute(ana, created[0]?.token.id ?? '');

    await expect(create.execute(ana, { name: 'again', lifetimeDays: 30 })).resolves.toBeDefined();
  });
});

describe('ListAccessTokensUseCase', () => {
  it('lists the live tokens of the admin, the newest first, without the expired or revoked', async () => {
    const { create, list, revoke, clock, ana, bruno } = await setup();
    const short = await create.execute(ana, { name: 'short', lifetimeDays: 30 });
    const kept = await create.execute(ana, { name: 'kept', lifetimeDays: 90 });
    const gone = await create.execute(ana, { name: 'gone', lifetimeDays: 90 });
    const newest = await create.execute(ana, { name: 'newest', lifetimeDays: 90 });
    await create.execute(bruno, { name: 'not hers', lifetimeDays: 90 });
    await revoke.execute(ana, gone.token.id);
    clock.advanceBy(31 * DAY_MS);

    const listed = await list.execute(ana);

    expect(listed.map((token) => token.id)).toEqual([newest.token.id, kept.token.id]);
    expect(listed.map((token) => token.id)).not.toContain(short.token.id);
  });
});

describe('RevokeAccessTokenUseCase', () => {
  it('revokes a token of the admin once and logs it', async () => {
    const { create, revoke, authenticate, ana } = await setup();
    const created = await create.execute(ana, { name: 'Claude Code', lifetimeDays: 30 });
    const logs: unknown[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((message: unknown) => {
      logs.push(message);
    });

    await revoke.execute(ana, created.token.id);

    await expect(authenticate.execute(created.secret)).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(revoke.execute(ana, created.token.id)).rejects.toBeInstanceOf(
      AccessTokenNotFoundError,
    );
    expect(logs).toEqual([
      { message: 'auth.access_token_revoked', adminUserId: ana.id, tokenId: created.token.id },
    ]);
  });

  it("answers not found for another admin's token and leaves it working", async () => {
    const { create, revoke, authenticate, ana, bruno } = await setup();
    const created = await create.execute(ana, { name: 'Claude Code', lifetimeDays: 30 });

    await expect(revoke.execute(bruno, created.token.id)).rejects.toBeInstanceOf(
      AccessTokenNotFoundError,
    );
    await expect(authenticate.execute(created.secret)).resolves.toMatchObject({ admin: ana });
  });
});

describe('AuthenticateAccessTokenUseCase', () => {
  async function withToken() {
    const context = await setup();
    const created = await context.create.execute(context.ana, {
      name: 'Claude Code',
      lifetimeDays: 30,
    });
    return { ...context, created };
  }

  it('answers the admin of a live token and records its first use', async () => {
    const { authenticate, tokens, created, ana } = await withToken();

    const authenticated = await authenticate.execute(created.secret);

    expect(authenticated.admin).toEqual(ana);
    expect(authenticated.token.id).toBe(created.token.id);
    expect(tokens.stored[0]?.token.lastUsedAt).toEqual(NOW);
  });

  it('records the use on the presented token only', async () => {
    const { authenticate, create, tokens, bruno, created } = await withToken();
    const other = await create.execute(bruno, { name: 'Cursor', lifetimeDays: 30 });

    await authenticate.execute(created.secret);

    const otherStored = tokens.stored.find((entry) => entry.token.id === other.token.id);
    expect(otherStored?.token.lastUsedAt).toBeNull();
  });

  it('records a later use only once the touch interval has passed', async () => {
    const { authenticate, tokens, clock, created } = await withToken();
    await authenticate.execute(created.secret);

    clock.advanceBy(ACCESS_TOKEN_TOUCH_INTERVAL_MS - 1);
    await authenticate.execute(created.secret);
    expect(tokens.stored[0]?.token.lastUsedAt).toEqual(NOW);

    clock.advanceBy(1);
    await authenticate.execute(created.secret);
    expect(tokens.stored[0]?.token.lastUsedAt).toEqual(
      new Date(NOW.getTime() + ACCESS_TOKEN_TOUCH_INTERVAL_MS),
    );
  });

  it('refuses an unknown token', async () => {
    const { authenticate } = await withToken();

    await expect(authenticate.execute(`pyxis_at_${'Z'.repeat(32)}`)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('refuses a token from the moment it expires', async () => {
    const { authenticate, clock, created } = await withToken();
    clock.advanceBy(30 * DAY_MS);

    await expect(authenticate.execute(created.secret)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('refuses a token whose admin no longer exists', async () => {
    const { tokens, clock, created } = await withToken();
    class NoAdmins extends InMemoryAdminUserRepository {
      override findById(): Promise<AdminUser | null> {
        return Promise.resolve(null);
      }
    }
    const withoutAdmins = new AuthenticateAccessTokenUseCase(tokens, new NoAdmins(), clock);

    await expect(withoutAdmins.execute(created.secret)).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });
});

import { Logger } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { sha256Hex } from '../../../domain/auth/hashing';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import { AccessTokenNotFoundError } from '../../../domain/errors/auth.errors';
import { FixedClock } from '../../../test-utils/fixed-clock';
import { InMemoryAccessTokenRepository } from '../../../test-utils/in-memory-access-token.repository';
import { SequenceRandomSource } from '../../../test-utils/sequence-random-source';
import { CreateAccessTokenUseCase } from '../../../usecases/auth/create-access-token.usecase';
import { ListAccessTokensUseCase } from '../../../usecases/auth/list-access-tokens.usecase';
import { RevokeAccessTokenUseCase } from '../../../usecases/auth/revoke-access-token.usecase';
import { AccessTokensController } from './access-tokens.controller';
import {
  accessTokensSchema,
  createAccessTokenSchema,
  createdAccessTokenSchema,
} from './access-tokens.schemas';

const NOW = new Date('2026-10-14T12:00:00.000Z');
const ADMIN: AdminUser = {
  id: '0d1e2f3a-4b5c-4d6e-8f7a-9b0c1d2e3f4a',
  email: 'ana@example.com',
  emailLanguage: 'en',
  createdAt: NOW,
};

function setup() {
  const tokens = new InMemoryAccessTokenRepository();
  const clock = new FixedClock(NOW);
  const random = new SequenceRandomSource(Array.from({ length: 62 }, (_, index) => index));
  const controller = new AccessTokensController(
    new CreateAccessTokenUseCase(tokens, random, clock),
    new ListAccessTokensUseCase(tokens, clock),
    new RevokeAccessTokenUseCase(tokens, clock),
  );
  const request = { admin: ADMIN } as FastifyRequest;
  return { tokens, clock, controller, request };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AccessTokensController', () => {
  it('answers a created token once, in the documented shape', async () => {
    const { tokens, controller, request } = setup();

    const body = await controller.create({ name: 'Claude Code', expires_in_days: 30 }, request);

    expect(createdAccessTokenSchema.parse(body)).toEqual(body);
    expect(body).toMatchObject({
      name: 'Claude Code',
      created_at: '2026-10-14T12:00:00.000Z',
      expires_at: '2026-11-13T12:00:00.000Z',
    });
    expect(tokens.stored[0]?.tokenHash).toBe(sha256Hex(body.token));
  });

  it('lists the live tokens without the tokens themselves, last use included', async () => {
    const { controller, clock, request } = setup();
    const created = await controller.create({ name: 'Claude Code', expires_in_days: 90 }, request);
    clock.advanceBy(1000);

    const listed = await controller.list(request);

    expect(accessTokensSchema.parse(listed)).toEqual(listed);
    expect(listed).toEqual({
      tokens: [
        {
          id: created.id,
          name: 'Claude Code',
          created_at: '2026-10-14T12:00:00.000Z',
          last_used_at: null,
          expires_at: '2027-01-12T12:00:00.000Z',
        },
      ],
    });
    expect(JSON.stringify(listed)).not.toContain(created.token);
  });

  it('shows when a token was last used', async () => {
    const { controller, tokens, request } = setup();
    const created = await controller.create({ name: 'Cursor', expires_in_days: 30 }, request);
    await tokens.touch(created.id, new Date('2026-10-15T08:00:00.000Z'));

    const listed = await controller.list(request);

    expect(listed.tokens[0]?.last_used_at).toBe('2026-10-15T08:00:00.000Z');
  });

  it('revokes a token, after which revoking it again is not found', async () => {
    const { controller, request } = setup();
    const created = await controller.create({ name: 'Claude Code', expires_in_days: 30 }, request);

    await controller.revoke(request, created.id);

    expect((await controller.list(request)).tokens).toEqual([]);
    await expect(controller.revoke(request, created.id)).rejects.toBeInstanceOf(
      AccessTokenNotFoundError,
    );
  });
});

describe('createAccessTokenSchema', () => {
  it('trims the name and lives 90 days unless told otherwise', () => {
    expect(createAccessTokenSchema.parse({ name: '  Claude Code  ' })).toEqual({
      name: 'Claude Code',
      expires_in_days: 90,
    });
  });

  it.each([
    [{ name: '' }],
    [{ name: '   ' }],
    [{ name: 'x'.repeat(65) }],
    [{ name: 'Claude Code', expires_in_days: 7 }],
    [{ name: 'Claude Code', scope: 'write' }],
  ])('refuses %j', (body) => {
    expect(createAccessTokenSchema.safeParse(body).success).toBe(false);
  });
});

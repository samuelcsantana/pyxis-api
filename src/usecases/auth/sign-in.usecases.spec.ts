import { Logger } from '@nestjs/common';
import { sha256Hex } from '../../domain/auth/hashing';
import { SESSION_IDLE_TTL_MS, SESSION_TOUCH_INTERVAL_MS } from '../../domain/auth/session-policy';
import {
  MAX_SIGN_IN_CODE_ATTEMPTS,
  MAX_SIGN_IN_CODES_PER_WINDOW,
  SIGN_IN_CODE_TTL_MS,
} from '../../domain/auth/sign-in-code';
import type { Project } from '../../domain/entities/project.entity';
import { InvalidSignInCodeError, UnauthenticatedError } from '../../domain/errors/auth.errors';
import { FixedClock } from '../../test-utils/fixed-clock';
import { InMemoryAdminSessionRepository } from '../../test-utils/in-memory-admin-session.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryOtpCodeRepository } from '../../test-utils/in-memory-otp-code.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { SequenceRandomSource } from '../../test-utils/sequence-random-source';
import { AuthenticateSessionUseCase } from './authenticate-session.usecase';
import { DescribeAdminUseCase } from './describe-admin.usecase';
import { RequestSignInCodeUseCase } from './request-sign-in-code.usecase';
import { SignOutUseCase } from './sign-out.usecase';
import { VerifySignInCodeUseCase } from './verify-sign-in-code.usecase';

const ADMIN_EMAIL = 'ana@example.com';
const PROJECT: Project = {
  id: 'project-1',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: 'signup_completed',
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

async function setup() {
  const clock = new FixedClock(new Date('2026-10-06T14:00:00.000Z'));
  const random = new SequenceRandomSource([1, 2, 3, 4, 5, 6]);
  const admins = new InMemoryAdminUserRepository();
  admins.addProject(PROJECT);
  const admin = await admins.grantAccess(ADMIN_EMAIL, PROJECT.id);
  const codes = new InMemoryOtpCodeRepository();
  const sessions = new InMemoryAdminSessionRepository();
  const mail = new RecordingMailSender();
  return {
    clock,
    admin,
    codes,
    sessions,
    mail,
    requestCode: new RequestSignInCodeUseCase(admins, codes, mail, clock, random),
    verifyCode: new VerifySignInCodeUseCase(admins, codes, sessions, clock, random),
    authenticate: new AuthenticateSessionUseCase(sessions, admins, clock),
    signOut: new SignOutUseCase(sessions, clock),
    describe: new DescribeAdminUseCase(admins),
  };
}

describe('dashboard sign-in', () => {
  let logs: { level: string; message: unknown }[];

  beforeEach(() => {
    logs = [];
    const record = (level: string) => (message: unknown) => {
      logs.push({ level, message });
    };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(record('log'));
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(record('warn'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(record('error'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('RequestSignInCodeUseCase', () => {
    it('mails a code to an admin and stores only its hash', async () => {
      const { requestCode, mail, codes } = await setup();

      await requestCode.execute('  Ana@Example.com ');

      expect(mail.sent).toEqual([{ email: ADMIN_EMAIL, code: '123456' }]);
      expect(codes.stored).toEqual([
        expect.objectContaining({ email: ADMIN_EMAIL, codeHash: sha256Hex('123456') }),
      ]);
      expect(JSON.stringify(codes.stored)).not.toContain('"123456"');
    });

    it('does nothing for an email that is not an admin', async () => {
      const { requestCode, mail, codes } = await setup();

      await requestCode.execute('stranger@example.com');

      expect(mail.sent).toEqual([]);
      expect(codes.stored).toEqual([]);
    });

    it(`stops after ${String(MAX_SIGN_IN_CODES_PER_WINDOW)} codes an hour, without saying so`, async () => {
      const { requestCode, mail } = await setup();

      for (let request = 0; request <= MAX_SIGN_IN_CODES_PER_WINDOW; request += 1) {
        await requestCode.execute(ADMIN_EMAIL);
      }

      expect(mail.sent).toHaveLength(MAX_SIGN_IN_CODES_PER_WINDOW);
      expect(logs).toContainEqual({
        level: 'warn',
        message: { message: 'auth.code_rate_limited' },
      });
    });

    it('keeps the code and logs the failure, without the address, when the mail fails', async () => {
      const { requestCode, mail, codes } = await setup();
      mail.failWith(new Error('resend answered 500'));

      await expect(requestCode.execute(ADMIN_EMAIL)).resolves.toBeUndefined();

      expect(codes.stored).toHaveLength(1);
      expect(logs).toContainEqual({
        level: 'error',
        message: { message: 'auth.code_delivery_failed', error: 'resend answered 500' },
      });
      expect(JSON.stringify(logs)).not.toContain(ADMIN_EMAIL);
    });

    it('logs a failure that is not an Error too', async () => {
      const { requestCode, mail } = await setup();
      const failure: unknown = 'timeout';
      mail.failWith(failure as Error);

      await requestCode.execute(ADMIN_EMAIL);

      expect(logs).toContainEqual({
        level: 'error',
        message: { message: 'auth.code_delivery_failed', error: 'timeout' },
      });
    });
  });

  describe('VerifySignInCodeUseCase', () => {
    it('opens a session for the right code and returns its token once', async () => {
      const { requestCode, verifyCode, sessions } = await setup();
      await requestCode.execute(ADMIN_EMAIL);

      const signedIn = await verifyCode.execute(ADMIN_EMAIL, '123456');

      expect(signedIn.email).toBe(ADMIN_EMAIL);
      expect(sessions.stored).toEqual([
        expect.objectContaining({ tokenHash: sha256Hex(signedIn.sessionToken), revokedAt: null }),
      ]);
    });

    it('refuses a code used once already', async () => {
      const { requestCode, verifyCode } = await setup();
      await requestCode.execute(ADMIN_EMAIL);
      await verifyCode.execute(ADMIN_EMAIL, '123456');

      await expect(verifyCode.execute(ADMIN_EMAIL, '123456')).rejects.toBeInstanceOf(
        InvalidSignInCodeError,
      );
    });

    it(`kills the code after ${String(MAX_SIGN_IN_CODE_ATTEMPTS)} wrong guesses, even for the right one`, async () => {
      const { requestCode, verifyCode } = await setup();
      await requestCode.execute(ADMIN_EMAIL);

      for (let guess = 0; guess < MAX_SIGN_IN_CODE_ATTEMPTS; guess += 1) {
        await expect(verifyCode.execute(ADMIN_EMAIL, '000000')).rejects.toBeInstanceOf(
          InvalidSignInCodeError,
        );
      }

      await expect(verifyCode.execute(ADMIN_EMAIL, '123456')).rejects.toBeInstanceOf(
        InvalidSignInCodeError,
      );
    });

    it('refuses an expired code', async () => {
      const { requestCode, verifyCode, clock } = await setup();
      await requestCode.execute(ADMIN_EMAIL);
      clock.advanceBy(SIGN_IN_CODE_TTL_MS);

      await expect(verifyCode.execute(ADMIN_EMAIL, '123456')).rejects.toBeInstanceOf(
        InvalidSignInCodeError,
      );
    });

    it('refuses any code for an email that never asked for one', async () => {
      const { verifyCode } = await setup();

      await expect(verifyCode.execute('stranger@example.com', '123456')).rejects.toBeInstanceOf(
        InvalidSignInCodeError,
      );
    });

    it('never creates an admin: a valid code for an email that is no longer an admin fails', async () => {
      const { verifyCode, codes, clock, sessions } = await setup();
      await codes.create({
        email: 'former@example.com',
        codeHash: sha256Hex('123456'),
        createdAt: clock.now(),
        expiresAt: new Date(clock.now().getTime() + SIGN_IN_CODE_TTL_MS),
      });

      await expect(verifyCode.execute('former@example.com', '123456')).rejects.toBeInstanceOf(
        InvalidSignInCodeError,
      );
      expect(sessions.stored).toEqual([]);
    });
  });

  describe('sessions', () => {
    async function signedIn() {
      const context = await setup();
      await context.requestCode.execute(ADMIN_EMAIL);
      const { sessionToken } = await context.verifyCode.execute(ADMIN_EMAIL, '123456');
      return { ...context, sessionToken };
    }

    it('authenticates a live session and describes the admin with their projects', async () => {
      const { authenticate, describe: describeAdmin, sessionToken, admin } = await signedIn();

      const authenticated = await authenticate.execute(sessionToken);

      expect(authenticated).toEqual(admin);
      expect(await describeAdmin.execute(authenticated)).toEqual({
        email: ADMIN_EMAIL,
        projects: [PROJECT],
      });
    });

    it('records the last use at most every five minutes', async () => {
      const { authenticate, sessionToken, sessions, clock } = await signedIn();
      const startedAt = clock.now();

      clock.advanceBy(SESSION_TOUCH_INTERVAL_MS - 1);
      await authenticate.execute(sessionToken);
      expect(sessions.stored[0]?.session.lastUsedAt).toEqual(startedAt);

      clock.advanceBy(1);
      await authenticate.execute(sessionToken);
      expect(sessions.stored[0]?.session.lastUsedAt).toEqual(clock.now());
    });

    it.each([
      ['without a cookie', undefined],
      ['with an unknown token', 'not-a-session'],
    ])('refuses a request %s', async (_, token) => {
      const { authenticate } = await signedIn();

      await expect(authenticate.execute(token)).rejects.toBeInstanceOf(UnauthenticatedError);
    });

    it('refuses a session idle for a day', async () => {
      const { authenticate, sessionToken, clock } = await signedIn();
      clock.advanceBy(SESSION_IDLE_TTL_MS);

      await expect(authenticate.execute(sessionToken)).rejects.toBeInstanceOf(UnauthenticatedError);
    });

    it('refuses a session whose admin is gone', async () => {
      const { sessions, clock } = await setup();
      const orphanAdmins = new InMemoryAdminUserRepository();
      await sessions.create({
        adminUserId: 'gone',
        tokenHash: sha256Hex('token'),
        createdAt: clock.now(),
      });

      await expect(
        new AuthenticateSessionUseCase(sessions, orphanAdmins, clock).execute('token'),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
    });

    it('revokes the session on sign-out, after which it no longer authenticates', async () => {
      const { signOut, authenticate, sessionToken } = await signedIn();

      await signOut.execute(sessionToken);

      await expect(authenticate.execute(sessionToken)).rejects.toBeInstanceOf(UnauthenticatedError);
    });

    it.each([undefined, 'not-a-session'])(
      'signs out quietly without a live session (%j)',
      async (token) => {
        const { signOut } = await signedIn();

        await expect(signOut.execute(token)).resolves.toBeUndefined();
      },
    );
  });
});

import type { FastifyRequest } from 'fastify';
import type { AdminUser } from '../../../domain/entities/admin-user.entity';
import type { Project } from '../../../domain/entities/project.entity';
import { InMemoryEmailPreferencesRepository } from '../../../test-utils/in-memory-email-preferences.repository';
import { GetEmailPreferencesUseCase } from '../../../usecases/preferences/get-email-preferences.usecase';
import { SetEmailPreferencesUseCase } from '../../../usecases/preferences/set-email-preferences.usecase';
import { EmailPreferencesController } from './email-preferences.controller';
import { emailPreferenceChangesSchema, emailPreferencesSchema } from './email-preferences.schemas';

const ADMIN: AdminUser = {
  id: '00000000-0000-4000-a000-000000000001',
  email: 'ana@example.com',
  emailLanguage: 'en',
  suspendedAt: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'America/Sao_Paulo',
  conversionEvent: null,
  currency: 'BRL',
  cityEnabled: false,
  visitorsEnabled: false,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const REQUEST = { admin: ADMIN, project: PROJECT } as FastifyRequest;
const EVERYTHING_ON = {
  weekly_digest: true,
  no_events_alert: true,
  failed_writes_alert: true,
  conversion_drop_alert: true,
};

function controller() {
  const preferences = new InMemoryEmailPreferencesRepository();
  preferences.grant(ADMIN.id, PROJECT.id);
  return new EmailPreferencesController(
    new GetEmailPreferencesUseCase(preferences),
    new SetEmailPreferencesUseCase(preferences),
  );
}

describe('EmailPreferencesController', () => {
  it('answers the preferences of the signed-in admin in the contract shape', async () => {
    const body = await controller().preferences(REQUEST);

    expect(emailPreferencesSchema.parse(body)).toEqual(EVERYTHING_ON);
  });

  it('stores the chosen preferences and answers them', async () => {
    const preferencesController = controller();

    const body = await preferencesController.choose(REQUEST, { weekly_digest: false });

    expect(body).toEqual({ ...EVERYTHING_ON, weekly_digest: false });
    expect(await preferencesController.preferences(REQUEST)).toEqual({
      ...EVERYTHING_ON,
      weekly_digest: false,
    });
  });

  it('changes only the alerts sent, the deployed dashboard sending only the digest', async () => {
    const preferencesController = controller();

    await preferencesController.choose(
      REQUEST,
      emailPreferenceChangesSchema.parse({ no_events_alert: false, failed_writes_alert: false }),
    );
    const body = await preferencesController.choose(
      REQUEST,
      emailPreferenceChangesSchema.parse({ conversion_drop_alert: false }),
    );

    expect(body).toEqual({
      weekly_digest: true,
      no_events_alert: false,
      failed_writes_alert: false,
      conversion_drop_alert: false,
    });
  });

  it.each([
    ['an unknown field', { weekly_digest: true, monthly_digest: true }],
    ['a value that is not a boolean', { weekly_digest: 'yes' }],
    ['no value', {}],
  ])('rejects a body with %s', (_, body) => {
    expect(emailPreferenceChangesSchema.safeParse(body).success).toBe(false);
  });
});

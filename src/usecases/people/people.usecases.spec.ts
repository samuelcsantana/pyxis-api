import { Logger } from '@nestjs/common';
import type { AccountStatus } from '../../domain/accounts/account-status';
import { SubscriptionRequiredError } from '../../domain/errors/account.errors';
import {
  OwnerStaysError,
  PeopleLimitReachedError,
  PersonNotFoundError,
} from '../../domain/errors/people.errors';
import { ProjectNotFoundError } from '../../domain/errors/project.errors';
import { InMemoryAccountRepository } from '../../test-utils/in-memory-account.repository';
import { InMemoryAdminUserRepository } from '../../test-utils/in-memory-admin-user.repository';
import { InMemoryProjectPeopleRepository } from '../../test-utils/in-memory-project-people.repository';
import { InMemoryProjectRepository } from '../../test-utils/in-memory-project.repository';
import { RecordingMailSender } from '../../test-utils/recording-mail-sender';
import { AddProjectPersonUseCase } from './add-project-person.usecase';
import { ListProjectPeopleUseCase } from './list-project-people.usecase';
import { RemoveProjectPersonUseCase } from './remove-project-person.usecase';
import { RevokeAdminAccessUseCase } from './revoke-admin-access.usecase';

const OWNER_EMAIL = 'owner@example.com';
const STRANGER_ID = 'ad000000-0000-4000-a000-0000000000ff';
const SETTINGS = {
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
};

async function setup(status: AccountStatus = 'active') {
  const admins = new InMemoryAdminUserRepository();
  const accounts = new InMemoryAccountRepository(admins);
  const store = new InMemoryProjectRepository();
  const people = new InMemoryProjectPeopleRepository();
  const mail = new RecordingMailSender();
  const owner = await admins.findOrCreateByEmail(OWNER_EMAIL);
  const account = await accounts.create({ ownerAdminId: owner.id, status });
  store.addAccount(account.id, owner.id);
  const createInAccount = async (name: string) => {
    const created = await store.createWithPublicKeyInAccount(
      { ...SETTINGS, name },
      `pyxis_pk_${name}`,
      { accountId: account.id, maxProjects: 3 },
    );
    if (created.outcome !== 'created') {
      throw new Error(`expected a project, got ${created.outcome}`);
    }
    people.placeProject(created.created.project.id, account.id);
    people.addPerson(created.created.project.id, OWNER_EMAIL, owner.id);
    return created.created.project;
  };
  const shop = await createInAccount('Shop');
  return {
    admins,
    accounts,
    account,
    store,
    people,
    mail,
    owner,
    shop,
    createInAccount,
    listPeople: new ListProjectPeopleUseCase(people, store, accounts),
    addPerson: new AddProjectPersonUseCase(store, accounts, people, mail),
    removePerson: new RemoveProjectPersonUseCase(store, accounts, people),
    revokeAccess: new RevokeAdminAccessUseCase(admins, store, accounts, people),
  };
}

describe('AddProjectPersonUseCase', () => {
  it('adds a person to the project and e-mails the invitation in the language asked', async () => {
    const { addPerson, owner, shop, mail, people } = await setup();

    const added = await addPerson.execute({
      adminUserId: owner.id,
      inviterEmail: OWNER_EMAIL,
      projectId: shop.id,
      email: ' Guest@Example.com ',
      language: 'pt-BR',
    });

    expect(added).toEqual({
      added: true,
      person: expect.objectContaining({ email: 'guest@example.com' }) as unknown,
    });
    expect(mail.invitations).toEqual([
      {
        email: 'guest@example.com',
        invitation: { projectName: 'Shop', inviterEmail: OWNER_EMAIL },
        language: 'pt-BR',
      },
    ]);
    expect((await people.peopleOf(shop.id)).map(({ email }) => email)).toEqual([
      OWNER_EMAIL,
      'guest@example.com',
    ]);
  });

  it('answers a person already on the project without a second invitation', async () => {
    const { addPerson, owner, shop, mail } = await setup();
    const command = {
      adminUserId: owner.id,
      inviterEmail: OWNER_EMAIL,
      projectId: shop.id,
      email: 'guest@example.com',
      language: 'en' as const,
    };
    await addPerson.execute(command);

    const again = await addPerson.execute(command);

    expect(again.added).toBe(false);
    expect(mail.invitations).toHaveLength(1);
  });

  it('keeps the account to three people, the owner included, counting a person once', async () => {
    const { addPerson, owner, shop, createInAccount } = await setup();
    const blog = await createInAccount('Blog');
    const add = (projectId: string, email: string) =>
      addPerson.execute({
        adminUserId: owner.id,
        inviterEmail: OWNER_EMAIL,
        projectId,
        email,
        language: 'en',
      });
    await add(shop.id, 'ana@example.com');
    await add(shop.id, 'bia@example.com');

    await expect(add(shop.id, 'carla@example.com')).rejects.toBeInstanceOf(PeopleLimitReachedError);
    await expect(add(blog.id, 'ana@example.com')).resolves.toEqual(
      expect.objectContaining({ added: true }),
    );
  });

  it('keeps the person added when the invitation cannot be sent, and logs it', async () => {
    const { addPerson, owner, shop, mail, people } = await setup();
    mail.failFor('guest@example.com', new Error('provider down'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const added = await addPerson.execute({
      adminUserId: owner.id,
      inviterEmail: OWNER_EMAIL,
      projectId: shop.id,
      email: 'guest@example.com',
      language: 'en',
    });

    expect(added.added).toBe(true);
    expect(await people.peopleOf(shop.id)).toHaveLength(2);
    expect(error).toHaveBeenCalledWith({
      message: 'people.invitation_failed',
      reason: 'Error: provider down',
    });
    error.mockRestore();
  });

  it("answers not found for someone else's project, and refuses an account without access", async () => {
    const active = await setup();
    const ended = await setup('ended');

    await expect(
      active.addPerson.execute({
        adminUserId: STRANGER_ID,
        inviterEmail: 'stranger@example.com',
        projectId: active.shop.id,
        email: 'guest@example.com',
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    await expect(
      ended.addPerson.execute({
        adminUserId: ended.owner.id,
        inviterEmail: OWNER_EMAIL,
        projectId: ended.shop.id,
        email: 'guest@example.com',
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(SubscriptionRequiredError);
  });
});

describe('ListProjectPeopleUseCase', () => {
  it('lists the people of a project, telling the owner apart', async () => {
    const { listPeople, people, owner, shop } = await setup();
    const guest = people.addPerson(shop.id, 'guest@example.com');

    expect(await listPeople.execute(shop.id)).toEqual([
      expect.objectContaining({ adminUserId: owner.id, role: 'owner' }),
      expect.objectContaining({ adminUserId: guest.adminUserId, role: 'member' }),
    ]);
  });

  it("lists everyone as a member on the operator's projects, which have no owner", async () => {
    const { listPeople, people, store } = await setup();
    const { project } = await store.createWithPublicKey({ ...SETTINGS, name: 'Operator' }, 'pk');
    people.addPerson(project.id, 'operator@example.com');

    expect(await listPeople.execute(project.id)).toEqual([
      expect.objectContaining({ email: 'operator@example.com', role: 'member' }),
    ]);
  });
});

describe('RemoveProjectPersonUseCase', () => {
  it('removes a person from the project, even after the account has ended', async () => {
    const { removePerson, people, owner, shop } = await setup('ended');
    const guest = people.addPerson(shop.id, 'guest@example.com');

    await removePerson.execute({
      adminUserId: owner.id,
      projectId: shop.id,
      personId: guest.adminUserId,
    });

    expect((await people.peopleOf(shop.id)).map(({ email }) => email)).toEqual([OWNER_EMAIL]);
  });

  it('keeps the owner, and answers not found for someone who is not on the project', async () => {
    const { removePerson, owner, shop } = await setup();

    await expect(
      removePerson.execute({ adminUserId: owner.id, projectId: shop.id, personId: owner.id }),
    ).rejects.toBeInstanceOf(OwnerStaysError);
    await expect(
      removePerson.execute({ adminUserId: owner.id, projectId: shop.id, personId: STRANGER_ID }),
    ).rejects.toBeInstanceOf(PersonNotFoundError);
  });

  it("answers not found for someone else's project", async () => {
    const { removePerson, people, shop } = await setup();
    const guest = people.addPerson(shop.id, 'guest@example.com');

    await expect(
      removePerson.execute({
        adminUserId: guest.adminUserId,
        projectId: shop.id,
        personId: guest.adminUserId,
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });
});

describe('RevokeAdminAccessUseCase', () => {
  it('takes a person off a project by e-mail', async () => {
    const { revokeAccess, admins, people, shop } = await setup();
    const guest = await admins.findOrCreateByEmail('guest@example.com');
    people.addPerson(shop.id, 'guest@example.com', guest.id);

    const revoked = await revokeAccess.execute({ email: 'Guest@example.com', projectId: shop.id });

    expect(revoked).toEqual({
      adminUserId: guest.id,
      email: 'guest@example.com',
      projectId: shop.id,
    });
    expect(await people.peopleOf(shop.id)).toHaveLength(1);
  });

  it("refuses the owner of the project's account, an unknown address and someone not on it", async () => {
    const { revokeAccess, admins, shop } = await setup();
    await admins.findOrCreateByEmail('elsewhere@example.com');

    await expect(
      revokeAccess.execute({ email: OWNER_EMAIL, projectId: shop.id }),
    ).rejects.toBeInstanceOf(OwnerStaysError);
    await expect(
      revokeAccess.execute({ email: 'nobody@example.com', projectId: shop.id }),
    ).rejects.toBeInstanceOf(PersonNotFoundError);
    await expect(
      revokeAccess.execute({ email: 'elsewhere@example.com', projectId: shop.id }),
    ).rejects.toBeInstanceOf(PersonNotFoundError);
  });

  it("takes anyone off the operator's projects", async () => {
    const { revokeAccess, admins, people, store } = await setup();
    const { project } = await store.createWithPublicKey({ ...SETTINGS, name: 'Operator' }, 'pk');
    const operator = await admins.findOrCreateByEmail('operator@example.com');
    people.addPerson(project.id, 'operator@example.com', operator.id);

    await revokeAccess.execute({ email: 'operator@example.com', projectId: project.id });

    expect(await people.peopleOf(project.id)).toEqual([]);
  });
});

import type { PostgresClient } from './drizzle.types';
import {
  createDrizzleDatabase,
  createPostgresClient,
  MISSING_DATABASE_URL_MESSAGE,
  PostgresClientLifecycle,
} from './postgres-client';

describe('createPostgresClient', () => {
  it('refuses to start without a connection string', () => {
    expect(() => createPostgresClient(undefined)).toThrow(MISSING_DATABASE_URL_MESSAGE);
  });

  it('creates a lazy client that connects only on the first query', async () => {
    const client = createPostgresClient('postgres://nobody@localhost:1/none');

    expect(typeof client.end).toBe('function');
    await client.end();
  });
});

describe('createDrizzleDatabase', () => {
  it('wraps the client in a Drizzle database', async () => {
    const client = createPostgresClient('postgres://nobody@localhost:1/none');

    expect(typeof createDrizzleDatabase(client).execute).toBe('function');
    await client.end();
  });
});

describe('PostgresClientLifecycle', () => {
  it('closes the connections when the module is destroyed', async () => {
    const end = jest.fn(() => Promise.resolve());

    await new PostgresClientLifecycle({ end } as unknown as PostgresClient).onModuleDestroy();

    expect(end).toHaveBeenCalledTimes(1);
  });
});

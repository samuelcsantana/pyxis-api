import { appRoleGrantStatements } from './app-role-grants';

describe('appRoleGrantStatements', () => {
  it('grants row access and takes away every structural right', () => {
    expect(appRoleGrantStatements('pyxis_app')).toEqual([
      'GRANT USAGE ON SCHEMA public TO pyxis_app',
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO pyxis_app',
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO pyxis_app',
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM pyxis_app',
      'REVOKE CREATE ON SCHEMA public FROM pyxis_app',
    ]);
  });

  it.each(['PyxisApp', 'pyxis-app', 'pyxis_app; DROP SCHEMA public', ''])(
    'refuses %j, which would be interpolated into SQL',
    (role) => {
      expect(() => appRoleGrantStatements(role)).toThrow('Invalid APP_DB_ROLE');
    },
  );
});

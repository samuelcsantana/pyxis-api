import { DomainError } from './domain.error';
import {
  InvalidProjectSettingsError,
  ProjectKeyNotFoundError,
  ProjectNotFoundError,
  ProjectSuspendedError,
} from './project.errors';

describe('project errors', () => {
  it.each([
    [new InvalidProjectSettingsError('timezone', 'Bad zone.'), 'invalid_project_settings'],
    [new ProjectNotFoundError(), 'project_not_found'],
    [new ProjectKeyNotFoundError(), 'key_not_found'],
    [new ProjectSuspendedError(null), 'project_suspended'],
  ])('%s carries a stable machine code', (error, code) => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(code);
    expect(error.message).not.toBe('');
  });

  it('keeps the origin a batch refused for a suspended reception came from', () => {
    expect(new ProjectSuspendedError('https://shop.example.com').allowedOrigin).toBe(
      'https://shop.example.com',
    );
  });

  it('names the setting that was refused', () => {
    expect(new InvalidProjectSettingsError('timezone', 'Bad zone.').field).toBe('timezone');
  });
});

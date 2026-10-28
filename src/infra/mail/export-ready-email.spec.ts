import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import type { ExportReady } from '../../domain/exports/export-ready';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import { buildExportReadyEmail, exportPageUrl } from './export-ready-email';

const LINKS = emailLinksFor('https://dashboard.example.com');
const READY: ExportReady = {
  projectId: 'p-1',
  exportId: 'e-1',
  projectName: 'My\n Shop',
  eventCount: 12_345,
  availableUntil: new Date('2026-11-09T13:00:00.000Z'),
};

describe('buildExportReadyEmail', () => {
  it('names the project, the number of events and the day the file goes', () => {
    const email = buildExportReadyEmail(READY, 'en', LINKS, null);

    expect(email.subject).toBe('Your export of My Shop is ready');
    expect(email.html).toContain('12,345 events, one per line.');
    expect(email.html).toContain('until November 9, 2026');
    expect(email.html).toContain('Download the file</a>');
  });

  it('links to the export page of the dashboard, not to the file itself', () => {
    const email = buildExportReadyEmail(READY, 'en', LINKS, null);

    expect(exportPageUrl(READY, LINKS)).toBe('https://dashboard.example.com/p-1/exports/e-1');
    expect(email.html).toContain('href="https://dashboard.example.com/p-1/exports/e-1"');
    expect(email.text).toContain('https://dashboard.example.com/p-1/exports/e-1');
  });

  it('writes the numbers and the date in the reader’s language', () => {
    expect(buildExportReadyEmail(READY, 'pt-BR', LINKS, null).html).toContain(
      '12.345 eventos, um por linha.',
    );
    expect(buildExportReadyEmail(READY, 'es', LINKS, null).subject).toBe(
      'La exportación de My Shop está lista',
    );
  });

  it('declares its language and keeps every line but the link short', () => {
    for (const language of EMAIL_LANGUAGES) {
      const email = buildExportReadyEmail(READY, language, LINKS, null);
      const prose = email.text.split('\n').filter((line) => !line.startsWith('https://'));
      expect(email.html).toContain(`<html lang="${language}" dir="ltr">`);
      expect(Math.max(...prose.map((line) => line.length))).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
    }
  });
});

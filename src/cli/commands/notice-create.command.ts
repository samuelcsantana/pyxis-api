import { readFileSync } from 'node:fs';
import path from 'node:path';
import { EMAIL_LANGUAGES, type EmailLanguage } from '../../domain/auth/email-language';
import {
  isCampaign,
  type NoticeContent,
  type NoticeText,
  parseNoticeText,
} from '../../domain/notices/operator-notice';
import { CliUsageError, flag, parseCommandArgs, requiredText } from '../cli-args';
import type { CliCommand } from '../cli-command';

export interface NoticeCreateArgs {
  readonly campaign: string;
  readonly content: NoticeContent;
  readonly includeEnded: boolean;
  readonly dryRun: boolean;
}

function readNotice(directory: string, language: EmailLanguage): NoticeText {
  const file = path.join(directory, `${language}.txt`);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    throw new CliUsageError(`Cannot read ${file}: write one text file per language.`);
  }
  return parseNoticeText(raw, language);
}

export const noticeCreateCommand: CliCommand<NoticeCreateArgs> = {
  usage:
    'npm run -s notice:create -- --campaign <name> ' +
    '--dir <folder with en.txt, pt-BR.txt, es.txt, de.txt, fr.txt, it.txt, nl.txt> ' +
    '[--include-ended] [--dry-run]',

  parse(argv) {
    const values = parseCommandArgs(argv, {
      campaign: { type: 'string' },
      dir: { type: 'string' },
      'include-ended': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    });
    const campaign = requiredText(values, 'campaign');
    if (!isCampaign(campaign)) {
      throw new CliUsageError(
        '--campaign is lower-case letters, digits and hyphens, up to 64 characters.',
      );
    }
    const directory = requiredText(values, 'dir');
    return {
      campaign,
      content: {
        en: readNotice(directory, 'en'),
        'pt-BR': readNotice(directory, 'pt-BR'),
        es: readNotice(directory, 'es'),
        de: readNotice(directory, 'de'),
        fr: readNotice(directory, 'fr'),
        it: readNotice(directory, 'it'),
        nl: readNotice(directory, 'nl'),
      },
      includeEnded: flag(values, 'include-ended'),
      dryRun: flag(values, 'dry-run'),
    };
  },

  async execute(context, args, output) {
    const outcome = await context.createOperatorNotice.execute(args);
    output.stdout(`campaign=${outcome.campaign}`);
    output.stdout(`dry_run=${String(!outcome.created)}`);
    output.stdout(`recipients=${String(outcome.recipients)}`);
    for (const language of EMAIL_LANGUAGES) {
      output.stdout(`recipients_${language}=${String(outcome.byLanguage[language])}`);
    }
    output.stderr(
      outcome.created
        ? 'Stored: the jobs function sends it on its next daily run, or now when invoked with ' +
            '{"job":"account-notices"}; each owner gets it once, in their language.'
        : 'Nothing was stored: run again without --dry-run to send it.',
    );
  },
};

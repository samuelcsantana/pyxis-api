import type { EmailLanguage } from '../../domain/auth/email-language';
import type { WeeklyDigest } from '../../domain/digest/weekly-digest';
import type { DateRange } from '../../domain/queries/date-range';
import {
  brandHeader,
  cardRow,
  DARK,
  DASHBOARD_URL,
  type EmailContent,
  emailDocument,
  heading,
  inkLink,
  LAYOUT_TABLE,
  LIGHT,
  MONO_FONTS,
  paragraph,
  SANS_FONTS,
  type TextBlock,
  wrapped,
} from './email-layout';
import { escapeHtml } from './escape-html';
import {
  WEEKLY_DIGEST_EMAIL_MESSAGES,
  type WeeklyDigestEmailMessages,
} from './weekly-digest-email-messages';

const INTL_LOCALES: Readonly<Record<EmailLanguage, string>> = { en: 'en-US', 'pt-BR': 'pt-BR' };
const PERCENT_SCALE = 100;
const BAR_MAX_HEIGHT_PX = 64;
const BAR_MIN_HEIGHT_PX = 3;
const EMPTY_BAR_HEIGHT_PX = 1;
const TILES_PER_ROW = 2;
const LEFT_TILE_GUTTER = '0 6px 12px 0';
const RIGHT_TILE_GUTTER = '0 0 12px 6px';
const TEXT_INDENT = '  ';
const TEXT_COLUMN_GAP = 2;

const ACCENT = '#f5b83d';
const NOTICE = { light: '#fff4dc', dark: '#2b2412' } as const;

const DIGEST_DARK_RULES = [
  `.pyxis-tile{background-color:${DARK.code}!important;}`,
  `.pyxis-notice{background-color:${NOTICE.dark}!important;}`,
  `.pyxis-rule{border-color:${DARK.line}!important;}`,
  `.pyxis-empty-bar{background-color:${DARK.line}!important;}`,
];

const DIGEST_NARROW_RULES = [
  '.pyxis-card{padding:20px!important;}',
  '.pyxis-tile{padding:12px!important;}',
];

const SMALL_MUTED: TextBlock = { tone: 'muted', size: 'small', margin: '0' };
const SECTION_GAP = '28px 0 8px 0';
const PREHEADER_SEPARATOR = ' · ';

interface Formats {
  readonly number: (value: number) => string;
  readonly change: (current: number, previous: number) => string | null;
  readonly share: (part: number, whole: number) => string;
  readonly shortWeek: (week: DateRange) => string;
  readonly longWeek: (week: DateRange) => string;
  readonly weekday: (isoDate: string) => string;
  readonly moment: (at: Date, timeZone: string) => string;
  readonly zone: (timeZone: string, on: Date) => string;
}

const NARROW_SPACES = /[\u2009\u202f]/g;
const OFFSET_ZONE_NAME_PREFIX = 'GMT';

function calendarDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function plainSpaces(text: string): string {
  return text.replace(NARROW_SPACES, ' ');
}

function formatsFor(language: EmailLanguage): Formats {
  const locale = INTL_LOCALES[language];
  const numbers = new Intl.NumberFormat(locale);
  const changes = new Intl.NumberFormat(locale, {
    style: 'percent',
    signDisplay: 'exceptZero',
    maximumFractionDigits: 0,
  });
  const shares = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const shortDays = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const longDays = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const weekdays = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' });
  return {
    number: (value) => numbers.format(value),
    change: (current, previous) => {
      const ratio = (current - previous) / previous;
      return Math.round(ratio * PERCENT_SCALE) === 0 ? null : changes.format(ratio);
    },
    share: (part, whole) => shares.format(part / whole),
    shortWeek: (week) =>
      plainSpaces(shortDays.formatRange(calendarDay(week.from), calendarDay(week.to))),
    longWeek: (week) =>
      plainSpaces(longDays.formatRange(calendarDay(week.from), calendarDay(week.to))),
    weekday: (isoDate) => weekdays.format(calendarDay(isoDate)),
    moment: (at, timeZone) =>
      new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short', timeZone }).format(
        at,
      ),
    zone: (timeZone, on) => {
      const name = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: 'longGeneric' })
        .formatToParts(on)
        .filter((part) => part.type === 'timeZoneName')
        .map((part) => part.value)
        .join('');
      return name.startsWith(OFFSET_ZONE_NAME_PREFIX) ? timeZone : name;
    },
  };
}

interface Tile {
  readonly label: string;
  readonly value: string;
  readonly note: string | null;
  readonly comparison: string;
}

interface Wording {
  readonly digest: WeeklyDigest;
  readonly messages: WeeklyDigestEmailMessages;
  readonly formats: Formats;
}

function comparison({ messages, formats }: Wording, current: number, previous: number): string {
  const before = formats.number(previous);
  if (previous === 0) {
    return messages.weekBeforeOnly(before);
  }
  const change = formats.change(current, previous);
  return change === null
    ? messages.unchangedFromWeekBefore(before)
    : messages.versusWeekBefore(change, before);
}

function convertingTile(wording: Wording): readonly Tile[] {
  const { digest, messages, formats } = wording;
  const converting = digest.convertingVisits;
  if (converting === null) {
    return [];
  }
  return [
    {
      label: messages.convertingVisits,
      value: formats.number(converting.current),
      note:
        digest.visits.current === 0
          ? null
          : messages.shareOfVisits(formats.share(converting.current, digest.visits.current)),
      comparison: comparison(wording, converting.current, converting.previous),
    },
  ];
}

function tiles(wording: Wording): readonly Tile[] {
  const { digest, messages, formats } = wording;
  const failures = digest.failedWrites;
  return [
    {
      label: messages.visits,
      value: formats.number(digest.visits.current),
      note: null,
      comparison: comparison(wording, digest.visits.current, digest.visits.previous),
    },
    {
      label: messages.identifiedUsers,
      value: formats.number(digest.identifiedUsers.current),
      note: messages.identifiedUsersNote,
      comparison: comparison(
        wording,
        digest.identifiedUsers.current,
        digest.identifiedUsers.previous,
      ),
    },
    ...convertingTile(wording),
    {
      label: messages.failedWrites,
      value: formats.number(failures.current.failed),
      note:
        failures.current.total === 0
          ? messages.noWrites
          : messages.ofWrites(
              formats.number(failures.current.total),
              formats.share(failures.current.failed, failures.current.total),
            ),
      comparison: comparison(wording, failures.current.failed, failures.previous.failed),
    },
  ];
}

function visitsSummary({ digest, messages, formats }: Wording): string {
  const { current, previous } = digest.visits;
  const count = messages.visitCount(formats.number(current), current);
  const change = previous === 0 ? null : formats.change(current, previous);
  return change === null ? count : `${count} (${change})`;
}

function overviewUrl(digest: WeeklyDigest): string {
  const query = new URLSearchParams({ from: digest.week.from, to: digest.week.to });
  return `${DASHBOARD_URL}${encodeURIComponent(digest.projectId)}/overview?${query.toString()}`;
}

function settingsUrl(digest: WeeklyDigest): string {
  return `${DASHBOARD_URL}${encodeURIComponent(digest.projectId)}/settings`;
}

function weekLine({ digest, messages, formats }: Wording): string {
  return messages.weekLine(
    formats.longWeek(digest.week),
    formats.zone(digest.timeZone, calendarDay(digest.week.to)),
  );
}

function quietWeekLines({ digest, messages, formats }: Wording): readonly string[] {
  if (digest.visits.current > 0) {
    return [];
  }
  const lastEvent =
    digest.lastEventAt === null
      ? messages.noEventEver
      : messages.lastEventAt(formats.moment(digest.lastEventAt, digest.timeZone));
  return [messages.noVisits, lastEvent];
}

function counted(
  { formats }: Wording,
  value: number,
  phrase: (formatted: string, count: number) => string,
): string {
  return phrase(formats.number(value), value);
}

function preheader(wording: Wording): string {
  const quiet = quietWeekLines(wording);
  if (quiet.length > 0) {
    return quiet.join(' ');
  }
  const { digest, messages } = wording;
  const converting =
    digest.convertingVisits === null
      ? []
      : [counted(wording, digest.convertingVisits.current, messages.convertingVisitCount)];
  return [
    counted(wording, digest.identifiedUsers.current, messages.identifiedUserCount),
    ...converting,
    counted(wording, digest.failedWrites.current.failed, messages.failedWriteCount),
  ].join(PREHEADER_SEPARATOR);
}

function sectionTitle(title: string): string {
  const style =
    `margin:${SECTION_GAP};font-family:${SANS_FONTS};font-size:13px;line-height:20px;` +
    `font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${LIGHT.muted};`;
  return `<h2 class="pyxis-muted" style="${style}">${escapeHtml(title)}</h2>`;
}

function noticeBlock(lines: readonly string[]): readonly string[] {
  if (lines.length === 0) {
    return [];
  }
  const style =
    `background-color:${NOTICE.light};border-left:4px solid ${ACCENT};border-radius:8px;` +
    'padding:14px 16px;';
  return [
    `<table ${LAYOUT_TABLE} width="100%" style="margin:16px 0 0 0;">`,
    '<tr>',
    `<td class="pyxis-notice" style="${style}">`,
    ...lines.map((line, index) =>
      paragraph(
        { tone: 'ink', size: 'body', margin: index === 0 ? '0' : '4px 0 0 0' },
        escapeHtml(line),
      ),
    ),
    '</td>',
    '</tr>',
    '</table>',
  ];
}

function tileCell(tile: Tile, column: number): string {
  const boxStyle = `background-color:${LIGHT.code};border-radius:10px;padding:14px 16px;`;
  const valueStyle =
    `margin:2px 0 2px 0;font-family:${SANS_FONTS};font-size:28px;line-height:34px;` +
    `font-weight:700;color:${LIGHT.ink};`;
  return [
    `<td width="50%" valign="top" style="padding:${column === 0 ? LEFT_TILE_GUTTER : RIGHT_TILE_GUTTER};">`,
    `<table ${LAYOUT_TABLE} width="100%">`,
    '<tr>',
    `<td class="pyxis-tile" valign="top" style="${boxStyle}">`,
    paragraph(SMALL_MUTED, escapeHtml(tile.label)),
    `<p class="pyxis-ink" style="${valueStyle}">${escapeHtml(tile.value)}</p>`,
    ...(tile.note === null ? [] : [paragraph(SMALL_MUTED, escapeHtml(tile.note))]),
    paragraph(SMALL_MUTED, escapeHtml(tile.comparison)),
    '</td>',
    '</tr>',
    '</table>',
    '</td>',
  ].join('\n');
}

function tileGrid(all: readonly Tile[]): readonly string[] {
  const rows: string[] = [];
  for (let start = 0; start < all.length; start += TILES_PER_ROW) {
    const row = all.slice(start, start + TILES_PER_ROW);
    const filler = row.length < TILES_PER_ROW ? ['<td width="50%"></td>'] : [];
    rows.push('<tr>', ...row.map((tile, column) => tileCell(tile, column)), ...filler, '</tr>');
  }
  return [`<table ${LAYOUT_TABLE} width="100%" style="margin:20px 0 0 0;">`, ...rows, '</table>'];
}

function barHeight(visits: number, busiest: number): number {
  if (visits === 0) {
    return EMPTY_BAR_HEIGHT_PX;
  }
  return Math.max(BAR_MIN_HEIGHT_PX, Math.round((visits / busiest) * BAR_MAX_HEIGHT_PX));
}

function dayColumn(
  { formats }: Wording,
  day: WeeklyDigest['days'][number],
  busiest: number,
): string {
  const height = barHeight(day.visits, busiest);
  const barClass = day.visits === 0 ? ' class="pyxis-empty-bar"' : '';
  const barColor = day.visits === 0 ? LIGHT.line : ACCENT;
  const valueStyle = `font-family:${SANS_FONTS};font-size:12px;line-height:16px;color:${LIGHT.ink};`;
  const labelStyle = `font-family:${SANS_FONTS};font-size:12px;line-height:16px;color:${LIGHT.muted};`;
  const barStyle =
    `height:${String(height)}px;background-color:${barColor};border-radius:3px 3px 0 0;` +
    'font-size:0;line-height:0;';
  return [
    '<td width="14%" valign="bottom" align="center" style="padding:0 3px;">',
    `<table ${LAYOUT_TABLE} width="100%">`,
    `<tr><td class="pyxis-ink" align="center" style="${valueStyle}padding-bottom:4px;">` +
      `${escapeHtml(formats.number(day.visits))}</td></tr>`,
    `<tr><td${barClass} height="${String(height)}" style="${barStyle}">&nbsp;</td></tr>`,
    `<tr><td class="pyxis-muted" align="center" style="${labelStyle}padding-top:6px;">` +
      `${escapeHtml(formats.weekday(day.date))}</td></tr>`,
    '</table>',
    '</td>',
  ].join('\n');
}

function dayBars(wording: Wording): readonly string[] {
  const days = wording.digest.days;
  const busiest = Math.max(0, ...days.map((day) => day.visits));
  return [
    sectionTitle(wording.messages.visitsPerDay),
    `<table ${LAYOUT_TABLE} width="100%">`,
    '<tr>',
    ...days.map((day) => dayColumn(wording, day, busiest)),
    '</tr>',
    '</table>',
  ];
}

interface ListRow {
  readonly name: string;
  readonly count: string;
}

function listBlock(title: string, rows: readonly ListRow[], empty: string): readonly string[] {
  if (rows.length === 0) {
    return [sectionTitle(title), paragraph({ ...SMALL_MUTED, size: 'body' }, escapeHtml(empty))];
  }
  const nameStyle =
    `padding:7px 12px 7px 0;font-family:${MONO_FONTS};font-size:13px;line-height:18px;` +
    `color:${LIGHT.ink};word-break:break-all;border-bottom:1px solid ${LIGHT.line};`;
  const countStyle =
    `padding:7px 0;font-family:${SANS_FONTS};font-size:13px;line-height:18px;` +
    `color:${LIGHT.muted};white-space:nowrap;border-bottom:1px solid ${LIGHT.line};`;
  return [
    sectionTitle(title),
    `<table ${LAYOUT_TABLE} width="100%">`,
    ...rows.map((row) =>
      [
        '<tr>',
        `<td class="pyxis-ink pyxis-rule" style="${nameStyle}">${escapeHtml(row.name)}</td>`,
        `<td class="pyxis-muted pyxis-rule" align="right" style="${countStyle}">` +
          `${escapeHtml(row.count)}</td>`,
        '</tr>',
      ].join('\n'),
    ),
    '</table>',
  ];
}

function pageRows({ digest, messages, formats }: Wording): readonly ListRow[] {
  return digest.topPages.map((page) => ({
    name: page.path,
    count: `${formats.number(page.views)} ${messages.views}`,
  }));
}

function eventRows({ digest, messages, formats }: Wording): readonly ListRow[] {
  return digest.topEvents.map((event) => ({
    name: event.name,
    count: `${formats.number(event.count)} ${messages.times}`,
  }));
}

function routeRows({ digest, messages, formats }: Wording): readonly ListRow[] {
  return digest.failingRoutes.map((route) => ({
    name: `${route.method} ${route.route}`,
    count: messages.failedOf(formats.number(route.failed), formats.number(route.total)),
  }));
}

function button(href: string, label: string): readonly string[] {
  const cellStyle = `background-color:${ACCENT};border-radius:8px;`;
  const linkStyle =
    `display:inline-block;padding:12px 20px;font-family:${SANS_FONTS};font-size:15px;` +
    `line-height:20px;font-weight:600;color:${LIGHT.ink};text-decoration:none;`;
  return [
    `<table ${LAYOUT_TABLE} style="margin:28px 0 0 0;">`,
    '<tr>',
    `<td style="${cellStyle}">`,
    `<a href="${escapeHtml(href)}" style="${linkStyle}">${escapeHtml(label)}</a>`,
    '</td>',
    '</tr>',
    '</table>',
  ];
}

function card(wording: Wording): readonly string[] {
  const { digest, messages } = wording;
  return cardRow([
    paragraph({ ...SMALL_MUTED, margin: '0 0 4px 0' }, escapeHtml(messages.kicker)),
    heading(digest.projectName),
    paragraph(SMALL_MUTED, escapeHtml(weekLine(wording))),
    ...noticeBlock(quietWeekLines(wording)),
    ...tileGrid(tiles(wording)),
    ...dayBars(wording),
    ...listBlock(messages.topPages, pageRows(wording), messages.noPageViews),
    ...listBlock(messages.topEvents, eventRows(wording), messages.noNamedEvents),
    ...listBlock(messages.failingRoutes, routeRows(wording), messages.noFailedWrites),
    ...button(overviewUrl(digest), messages.openWeek),
  ]);
}

function footer({ digest, messages }: Wording): readonly string[] {
  const footnote: TextBlock = { tone: 'muted', size: 'small', margin: '0 0 8px 0' };
  return [
    '<tr>',
    '<td style="padding:24px 8px 0 8px;">',
    paragraph(footnote, escapeHtml(messages.reason(digest.projectName))),
    paragraph(
      footnote,
      `${escapeHtml(messages.turnOff)}
${inkLink(settingsUrl(digest), messages.settings)}.`,
    ),
    paragraph({ ...footnote, margin: '0' }, escapeHtml(messages.about)),
    '</td>',
    '</tr>',
  ];
}

function buildHtml(wording: Wording, subject: string): string {
  return emailDocument({
    language: wording.messages.language,
    title: subject,
    preheader: preheader(wording),
    rows: [...brandHeader(wording.messages.logoAlt), ...card(wording), ...footer(wording)],
    darkRules: DIGEST_DARK_RULES,
    narrowRules: DIGEST_NARROW_RULES,
  });
}

function textTable(rows: readonly ListRow[], empty: string): readonly string[] {
  if (rows.length === 0) {
    return [`${TEXT_INDENT}${empty}`];
  }
  const width = Math.max(...rows.map((row) => row.name.length)) + TEXT_COLUMN_GAP;
  return rows.map((row) => `${TEXT_INDENT}${row.name.padEnd(width)}${row.count}`);
}

function buildText(wording: Wording): string {
  const { digest, messages, formats } = wording;
  const tileLines = tiles(wording).map((tile) => {
    const note = tile.note === null ? '' : ` (${tile.note})`;
    return `${tile.label}: ${tile.value}${note} · ${tile.comparison}`;
  });
  const dayRows = digest.days.map((day) => ({
    name: formats.weekday(day.date),
    count: formats.number(day.visits),
  }));
  const quiet = quietWeekLines(wording);
  return [
    `${messages.kicker}: ${digest.projectName}`,
    ...wrapped(weekLine(wording)),
    '',
    ...(quiet.length === 0 ? [] : [...quiet.flatMap(wrapped), '']),
    ...tileLines.flatMap(wrapped),
    '',
    messages.visitsPerDay,
    ...textTable(dayRows, ''),
    '',
    messages.topPages,
    ...textTable(pageRows(wording), messages.noPageViews),
    '',
    messages.topEvents,
    ...textTable(eventRows(wording), messages.noNamedEvents),
    '',
    messages.failingRoutes,
    ...textTable(routeRows(wording), messages.noFailedWrites),
    '',
    `${messages.openWeek}: ${overviewUrl(digest)}`,
    '',
    ...wrapped(messages.reason(digest.projectName)),
    `${messages.turnOff} ${messages.settings}: ${settingsUrl(digest)}`,
    ...wrapped(messages.about),
  ].join('\n');
}

export function renderWeeklyDigestEmail(
  digest: WeeklyDigest,
  messages: WeeklyDigestEmailMessages,
): EmailContent {
  const wording: Wording = { digest, messages, formats: formatsFor(messages.language) };
  const subject = messages.subject(
    digest.projectName,
    wording.formats.shortWeek(digest.week),
    visitsSummary(wording),
  );
  return { subject, html: buildHtml(wording, subject), text: buildText(wording) };
}

export function buildWeeklyDigestEmail(
  digest: WeeklyDigest,
  language: EmailLanguage,
): EmailContent {
  return renderWeeklyDigestEmail(digest, WEEKLY_DIGEST_EMAIL_MESSAGES[language]);
}

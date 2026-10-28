const QUOTE = '"';
const ESCAPED_QUOTE = '""';
const SEPARATOR = ',';
const RECORD_END = '\r\n';
const LINE_BREAKS = ['\r', '\n'];

export class MalformedCsvError extends Error {}

interface ReadField {
  readonly value: string;
  readonly end: number;
}

function readBareField(body: string, start: number): ReadField {
  const separatorAt = body.indexOf(SEPARATOR, start);
  const end = separatorAt === -1 ? body.length : separatorAt;
  const value = body.slice(start, end);
  if (value.includes(QUOTE) || LINE_BREAKS.some((lineBreak) => value.includes(lineBreak))) {
    throw new MalformedCsvError(`an unquoted field holds a quote or a line break: ${value}`);
  }
  return { value, end };
}

function readQuotedField(body: string, start: number): ReadField {
  let value = '';
  let index = start + QUOTE.length;
  while (index < body.length) {
    if (body.startsWith(ESCAPED_QUOTE, index)) {
      value += QUOTE;
      index += ESCAPED_QUOTE.length;
    } else if (body.startsWith(QUOTE, index)) {
      return { value, end: index + QUOTE.length };
    } else {
      value += body.charAt(index);
      index += 1;
    }
  }
  throw new MalformedCsvError('a quoted field is never closed');
}

export function readCsvRecord(text: string): string[] {
  if (!text.endsWith(RECORD_END)) {
    throw new MalformedCsvError('the record does not end with CRLF');
  }
  const body = text.slice(0, -RECORD_END.length);
  const fields: string[] = [];
  let start = 0;
  let more = true;
  while (more) {
    const { value, end } = body.startsWith(QUOTE, start)
      ? readQuotedField(body, start)
      : readBareField(body, start);
    fields.push(value);
    more = end < body.length;
    if (more && !body.startsWith(SEPARATOR, end)) {
      throw new MalformedCsvError(`text follows a quoted field at ${String(end)}`);
    }
    start = end + SEPARATOR.length;
  }
  return fields;
}

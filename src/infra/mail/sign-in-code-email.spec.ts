import { EMAIL_LANGUAGES } from '../../domain/auth/email-language';
import { emailLinksFor, TEXT_LINE_WIDTH } from './email-layout';
import {
  buildSignInCodeEmail,
  buildSignUpCodeEmail,
  renderSignInCodeEmail,
} from './sign-in-code-email';
import type { SignInCodeEmailMessages } from './sign-in-code-email-messages';

const LINKS = emailLinksFor('https://dashboard.example.com');

const CODE = '123456';
const HTML_LINE_LIMIT = 400;
const GMAIL_CLIPPING_BYTES = 102 * 1024;
const HOSTILE = `<i>&"'`;
const ESCAPED_HOSTILE = '&lt;i&gt;&amp;&quot;&#39;';

const HOSTILE_MESSAGES: SignInCodeEmailMessages = {
  language: 'en',
  subject: () => HOSTILE,
  preheader: () => HOSTILE,
  heading: HOSTILE,
  instruction: HOSTILE,
  expiry: () => HOSTILE,
  neverShare: HOSTILE,
  notRequested: HOSTILE,
  about: HOSTILE,
  reason: HOSTILE,
  dashboard: HOSTILE,
  logoAlt: HOSTILE,
};
const HTML_SLOTS_IN_HOSTILE_MESSAGES = 12;

function longestLine(content: string): number {
  return Math.max(...content.split('\n').map((line) => line.length));
}

function occurrences(content: string, fragment: string): number {
  return content.split(fragment).length - 1;
}

describe('buildSignInCodeEmail in English', () => {
  const email = buildSignInCodeEmail(CODE, 'en', LINKS);

  it('keeps the code first in the subject', () => {
    expect(email.subject).toBe('123456 is your Pyxis sign-in code');
  });

  it('shows the code in the inbox list through a hidden preheader', () => {
    expect(email.html).toMatch(/<div style="display:none;[^"]*">Your code is 123456\. It expires/);
  });

  it('says how long the code lasts, that it works once, and how to treat it', () => {
    for (const part of [email.html, email.text]) {
      expect(part).toContain('It expires in 10 minutes and works once.');
      expect(part).toContain('Never share this code. No one from Pyxis will ever ask you for it.');
      expect(part).toContain('Didn’t ask to sign in? You can ignore this email:');
    }
  });

  it('ends with what Pyxis is, why the email came and the dashboard address', () => {
    for (const part of [email.html, email.text]) {
      expect(part).toContain('Pyxis is privacy-first product analytics');
      expect(part).toContain('You received this email because a sign-in');
    }
    expect(email.text).toContain(`Dashboard: ${LINKS.dashboardUrl}`);
  });

  it('declares English as its language', () => {
    expect(email.html).toContain('<html lang="en" dir="ltr">');
  });
});

describe('buildSignInCodeEmail in Brazilian Portuguese', () => {
  const email = buildSignInCodeEmail(CODE, 'pt-BR', LINKS);

  it('keeps the code first in the subject', () => {
    expect(email.subject).toBe('123456 é o seu código para entrar no Pyxis');
  });

  it('shows the code in the inbox list through a hidden preheader', () => {
    expect(email.html).toMatch(/<div style="display:none;[^"]*">Seu código é 123456\. Ele expira/);
  });

  it('names the page where the code goes by the title the dashboard gives it', () => {
    expect(email.html).toContain('Digite este código na página “Entrar no Pyxis”');
    expect(email.text).toContain('Digite este código na página “Entrar no Pyxis”');
  });

  it('says how long the code lasts, that it works once, and how to treat it', () => {
    for (const part of [email.html, email.text.replaceAll('\n', ' ')]) {
      expect(part).toContain('Ele expira em 10 minutos e só vale uma vez.');
      expect(part).toContain(
        'Nunca compartilhe este código. Ninguém do Pyxis vai pedir esse código a você.',
      );
      expect(part).toContain('Não pediu para entrar? Pode ignorar este e-mail:');
    }
  });

  it('ends with what Pyxis is, why the email came and the dashboard address', () => {
    for (const part of [email.html, email.text]) {
      expect(part).toContain('O Pyxis é uma ferramenta de análise de produto');
      expect(part).toContain('Você recebeu este e-mail porque alguém pediu para entrar');
    }
    expect(email.text).toContain(`Painel: ${LINKS.dashboardUrl}`);
  });

  it('declares Brazilian Portuguese as its language', () => {
    expect(email.html).toContain('<html lang="pt-BR" dir="ltr">');
  });
});

describe('buildSignInCodeEmail in Spanish', () => {
  const email = buildSignInCodeEmail(CODE, 'es', LINKS);

  it('keeps the code first in the subject', () => {
    expect(email.subject).toBe('123456 es tu código para iniciar sesión en Pyxis');
  });

  it('shows the code in the inbox list through a hidden preheader', () => {
    expect(email.html).toMatch(/<div style="display:none;[^"]*">Tu código es 123456\. Expira/);
  });

  it('names the page where the code goes by the title the dashboard gives it', () => {
    expect(email.html).toContain('Escribe este código en la página “Iniciar sesión en Pyxis”');
    expect(email.text).toContain('Escribe este código en la página “Iniciar sesión en Pyxis”');
  });

  it('says how long the code lasts, that it works once, and how to treat it', () => {
    for (const part of [email.html, email.text.replaceAll('\n', ' ')]) {
      expect(part).toContain('Expira en 10 minutos y solo sirve una vez.');
      expect(part).toContain('Nunca compartas este código. Nadie de Pyxis te lo va a pedir.');
      expect(part).toContain('¿No pediste iniciar sesión? Puedes ignorar este correo:');
    }
  });

  it('ends with what Pyxis is, why the email came and the dashboard address', () => {
    for (const part of [email.html, email.text]) {
      expect(part).toContain('Pyxis es analítica de producto que prioriza la privacidad');
      expect(part).toContain('Recibiste este correo porque alguien pidió iniciar sesión');
    }
    expect(email.text).toContain(`Panel: ${LINKS.dashboardUrl}`);
  });

  it('declares Spanish as its language', () => {
    expect(email.html).toContain('<html lang="es" dir="ltr">');
  });
});

describe.each(EMAIL_LANGUAGES)('the %s sign-in email', (language) => {
  const email = buildSignInCodeEmail(CODE, language, LINKS);

  it('puts the code in the HTML and on a line of its own in the plain text', () => {
    expect(email.html).toContain('>123456</td>');
    expect(email.text).toContain('\n    123456\n');
  });

  it('writes the code as one run of digits, so a double-click selects all of it', () => {
    expect(email.html).toMatch(/<td class="pyxis-code"[^>]*>123456<\/td>/);
  });

  it('loads no image but the logo, sized and described for clients that block it', () => {
    expect(occurrences(email.html, '<img')).toBe(1);
    expect(email.html).toContain(
      `<img src="${LINKS.logoUrl}" srcset="${LINKS.logo2xUrl} 2x" width="40" height="40" alt="Pyxis"`,
    );
  });

  it('links only to the dashboard, with no tracking parameters', () => {
    const links = [...email.html.matchAll(/href="([^"]*)"/g)].map(([, href]) => href);

    expect(links).toEqual([LINKS.dashboardUrl]);
    expect(LINKS.dashboardUrl).not.toContain('?');
  });

  it('carries its styles inline and in its head, never from another file', () => {
    expect(email.html).not.toMatch(/<link\b|@import|url\(/i);
  });

  it('keeps the layout tables out of the accessibility tree', () => {
    const tables = email.html.match(/<table\b[^>]*>/g) ?? [];

    expect(tables.length).toBeGreaterThan(0);
    expect(tables.filter((table) => !table.includes('role="presentation"'))).toEqual([]);
  });

  it("follows the reader's light or dark preference where the client supports it", () => {
    expect(email.html).toContain('<meta name="color-scheme" content="light dark">');
    expect(email.html).toContain('<meta name="supported-color-schemes" content="light dark">');
    expect(email.html).toContain('@media (prefers-color-scheme:dark){');
  });

  it('keeps every line short enough for mail servers and plain-text readers', () => {
    expect(longestLine(email.html)).toBeLessThanOrEqual(HTML_LINE_LIMIT);
    expect(longestLine(email.text)).toBeLessThanOrEqual(TEXT_LINE_WIDTH);
  });

  it('stays far below the size at which Gmail clips a message', () => {
    expect(Buffer.byteLength(email.html)).toBeLessThan(GMAIL_CLIPPING_BYTES);
  });
});

describe('renderSignInCodeEmail', () => {
  it('escapes the code and every message before they reach the HTML', () => {
    const { html } = renderSignInCodeEmail(HOSTILE, HOSTILE_MESSAGES, LINKS);

    expect(html).not.toContain('<i>');
    expect(occurrences(html, ESCAPED_HOSTILE)).toBe(HTML_SLOTS_IN_HOSTILE_MESSAGES);
  });

  it('leaves the plain text as written, since no client reads it as markup', () => {
    const { subject, text } = renderSignInCodeEmail(HOSTILE, HOSTILE_MESSAGES, LINKS);

    expect(subject).toBe(HOSTILE);
    expect(text).toContain(`    ${HOSTILE}`);
  });
});

describe('buildSignInCodeEmail for another dashboard', () => {
  const elsewhere = 'https://pyxis.example.org:8443';
  const email = buildSignInCodeEmail(CODE, 'en', emailLinksFor(elsewhere));

  it('links to the dashboard it is given, named by its host', () => {
    expect(email.html).toContain(`href="${elsewhere}/"`);
    expect(email.html).toContain('>pyxis.example.org:8443</a>');
    expect(email.text).toContain(`Dashboard: ${elsewhere}/`);
  });

  it('loads its logo from that dashboard', () => {
    expect(email.html).toContain(`<img src="${elsewhere}/email/pyxis-logo.png"`);
  });
});

describe('buildSignUpCodeEmail', () => {
  it('says the code creates an account, in each language, keeping the code first', () => {
    expect(buildSignUpCodeEmail(CODE, 'en', LINKS).subject).toBe(
      '123456 is your code to create a Pyxis account',
    );
    expect(buildSignUpCodeEmail(CODE, 'pt-BR', LINKS).subject).toBe(
      '123456 é o seu código para criar a conta no Pyxis',
    );
    expect(buildSignUpCodeEmail(CODE, 'es', LINKS).subject).toBe(
      '123456 es tu código para crear una cuenta de Pyxis',
    );
  });

  it('tells someone who did not ask that nothing is created without the code', () => {
    const email = buildSignUpCodeEmail(CODE, 'en', LINKS);

    expect(email.html).toContain('Your code to create an account');
    expect(email.html).toContain('nothing is created without this code.');
    expect(email.html).toContain('someone asked to create a Pyxis account with this address.');
    expect(email.text).toContain(
      'Enter this code on the Pyxis sign-up page to create your account.',
    );
    for (const part of [email.html, email.text]) {
      expect(part).not.toContain('sign in');
    }
  });

  it('keeps the expiry and the warning of the sign-in code, in the language asked', () => {
    const email = buildSignUpCodeEmail(CODE, 'pt-BR', LINKS);

    expect(email.text).toContain('Ele expira em 10 minutos e só vale uma vez.');
    expect(email.text).toContain('Nunca compartilhe este código.');
    expect(email.html).toContain('<html lang="pt-BR" dir="ltr">');
  });

  it('keeps every plain-text line within the width of the sign-in code e-mail', () => {
    for (const language of EMAIL_LANGUAGES) {
      expect(longestLine(buildSignUpCodeEmail(CODE, language, LINKS).text)).toBeLessThanOrEqual(
        TEXT_LINE_WIDTH,
      );
    }
  });
});

import { emailLinksFor } from './email-layout';

describe('emailLinksFor', () => {
  it('points the dashboard link and the logo at the origin it is given', () => {
    expect(emailLinksFor('https://dashboard.example.com')).toEqual({
      dashboardUrl: 'https://dashboard.example.com/',
      dashboardHost: 'dashboard.example.com',
      logoUrl: 'https://dashboard.example.com/email/pyxis-logo.png',
      logo2xUrl: 'https://dashboard.example.com/email/pyxis-logo@2x.png',
    });
  });

  it('keeps a non-default port in the host the e-mail shows', () => {
    expect(emailLinksFor('http://localhost:3000').dashboardHost).toBe('localhost:3000');
  });

  it('uses the origin alone, so a path never ends up inside the links', () => {
    expect(emailLinksFor('https://dashboard.example.com/app/').dashboardUrl).toBe(
      'https://dashboard.example.com/',
    );
  });
});

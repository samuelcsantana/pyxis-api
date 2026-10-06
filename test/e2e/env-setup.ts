import { e2eAppUrl } from './e2e-database';

export const E2E_CLIENT_IP_HEADER = 'x-e2e-client-ip';
export const E2E_DASHBOARD_ORIGIN = 'https://dashboard.example.com';

process.env.DATABASE_URL = e2eAppUrl();
process.env.CLIENT_IP_HEADER = E2E_CLIENT_IP_HEADER;
process.env.DASHBOARD_ORIGIN = E2E_DASHBOARD_ORIGIN;

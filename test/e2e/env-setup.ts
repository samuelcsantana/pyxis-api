import { appUrl } from '../local-database';

process.env.DATABASE_URL = appUrl();

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../../../config/env.schema';
import { REMOTE_MCP_SETTINGS } from '../../../domain/oauth/remote-mcp-settings';
import { AUTHORIZATION_REQUEST_REPOSITORY } from '../../../domain/repositories/authorization-request.repository';
import { OAUTH_CONNECTION_REPOSITORY } from '../../../domain/repositories/oauth-connection.repository';
import { CLIENT_METADATA_SOURCE } from '../../../domain/services/client-metadata-source';
import { CLOCK, type Clock } from '../../../domain/services/clock';
import { RANDOM_SOURCE } from '../../../domain/services/random-source';
import { ApproveAuthorizationRequestUseCase } from '../../../usecases/oauth/approve-authorization-request.usecase';
import { BeginAuthorizationUseCase } from '../../../usecases/oauth/begin-authorization.usecase';
import { DenyAuthorizationRequestUseCase } from '../../../usecases/oauth/deny-authorization-request.usecase';
import { DescribeAuthorizationRequestUseCase } from '../../../usecases/oauth/describe-authorization-request.usecase';
import { ExchangeAuthorizationCodeUseCase } from '../../../usecases/oauth/exchange-authorization-code.usecase';
import { ListConnectionsUseCase } from '../../../usecases/oauth/list-connections.usecase';
import { RefreshConnectionTokensUseCase } from '../../../usecases/oauth/refresh-connection-tokens.usecase';
import { RevokeConnectionUseCase } from '../../../usecases/oauth/revoke-connection.usecase';
import { RevokeOAuthTokenUseCase } from '../../../usecases/oauth/revoke-oauth-token.usecase';
import {
  CachingClientMetadataSource,
  HttpClientMetadataFetcher,
} from '../../oauth/http-client-metadata-source';
import { CryptoRandomSource } from '../../random/crypto-random-source';
import { DrizzleAuthorizationRequestRepository } from '../../repositories/drizzle-authorization-request.repository';
import { DrizzleOAuthConnectionRepository } from '../../repositories/drizzle-oauth-connection.repository';
import { AuthModule } from '../auth/auth.module';
import { AuthorizationRequestsController } from './authorization-requests.controller';
import { AuthorizationServerController } from './authorization-server.controller';
import { ConnectionsController } from './connections.controller';
import { remoteMcpSettingsFromEnv } from './remote-mcp-settings-from-env';

@Module({
  imports: [AuthModule],
  controllers: [
    AuthorizationServerController,
    AuthorizationRequestsController,
    ConnectionsController,
  ],
  providers: [
    BeginAuthorizationUseCase,
    DescribeAuthorizationRequestUseCase,
    ApproveAuthorizationRequestUseCase,
    DenyAuthorizationRequestUseCase,
    ExchangeAuthorizationCodeUseCase,
    RefreshConnectionTokensUseCase,
    RevokeOAuthTokenUseCase,
    ListConnectionsUseCase,
    RevokeConnectionUseCase,
    { provide: RANDOM_SOURCE, useClass: CryptoRandomSource },
    { provide: AUTHORIZATION_REQUEST_REPOSITORY, useClass: DrizzleAuthorizationRequestRepository },
    { provide: OAUTH_CONNECTION_REPOSITORY, useClass: DrizzleOAuthConnectionRepository },
    {
      provide: CLIENT_METADATA_SOURCE,
      inject: [CLOCK],
      useFactory: (clock: Clock) =>
        new CachingClientMetadataSource(new HttpClientMetadataFetcher(), clock),
    },
    {
      provide: REMOTE_MCP_SETTINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) =>
        remoteMcpSettingsFromEnv({
          REMOTE_MCP_OPEN: config.get('REMOTE_MCP_OPEN', { infer: true }),
          API_ORIGIN: config.get('API_ORIGIN', { infer: true }),
          DASHBOARD_ORIGIN: config.get('DASHBOARD_ORIGIN', { infer: true }),
        }),
    },
  ],
  exports: [REMOTE_MCP_SETTINGS],
})
export class OAuthModule {}

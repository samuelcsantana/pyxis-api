import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OAuthModule } from '../oauth/oauth.module';
import { McpAccessGuard } from './mcp-access.guard';
import { McpController } from './mcp.controller';
import { ProtectedResourceController } from './protected-resource.controller';

@Module({
  imports: [AuthModule, OAuthModule],
  controllers: [ProtectedResourceController, McpController],
  providers: [McpAccessGuard],
})
export class McpModule {}

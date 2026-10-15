import { Module } from '@nestjs/common';
import { OAuthModule } from '../oauth/oauth.module';
import { ProtectedResourceController } from './protected-resource.controller';

@Module({
  imports: [OAuthModule],
  controllers: [ProtectedResourceController],
})
export class McpModule {}

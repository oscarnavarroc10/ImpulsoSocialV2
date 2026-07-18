import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatalogModule } from './modules/catalog';

@Module({
  imports: [CatalogModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

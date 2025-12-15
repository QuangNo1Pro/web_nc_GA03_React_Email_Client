import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Email',
        schema: require('../users/schemas/email.schema').EmailSchema,
      },
    ]),
    JwtModule.register({}), // Import JwtModule for JwtAuthGuard dependency
  ],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}

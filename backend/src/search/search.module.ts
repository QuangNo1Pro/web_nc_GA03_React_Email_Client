import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SearchService } from './search.service';
import { SearchController } from './search.controller';
import { EmbeddingsProcessorService } from './embeddings-processor.service';
import { EmailSchema } from '../users/schemas/email.schema';
import { EmailVectorSchema } from '../users/schemas/email-vector.schema';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Email', schema: EmailSchema },
      { name: 'EmailVector', schema: EmailVectorSchema }
    ]),
    forwardRef(() => AuthModule), // 🔐 Use forwardRef to avoid circular dependency
    AiModule,
  ],
  controllers: [SearchController],
  providers: [SearchService, EmbeddingsProcessorService],
  exports: [SearchService, EmbeddingsProcessorService],
})
export class SearchModule { }

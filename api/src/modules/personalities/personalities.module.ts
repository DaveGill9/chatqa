import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Personality, PersonalitySchema } from './personality.entity';
import { PersonalitiesController } from './personalities.controller';
import { PersonalitiesService } from './personalities.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Personality.name, schema: PersonalitySchema },
    ]),
  ],
  controllers: [PersonalitiesController],
  providers: [PersonalitiesService],
  exports: [PersonalitiesService],
})
export class PersonalitiesModule {}

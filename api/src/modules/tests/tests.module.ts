import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JobsModule } from '../jobs/jobs.module';
import { ResultsModule } from '../results/results.module';
import { ParseModule } from '../parse/parse.module';
import { TestSet, TestSetSchema } from './entities/test-set.entity';
import { TestCase, TestCaseSchema } from './entities/test-case.entity';
import { BotClientService } from './services/bot-client.service';
import { ScoreService } from './services/score.service';
import { FollowupService } from './services/followup.service';
import { ConvertService } from './services/convert.service';
import { TestsService } from './services/tests.service';
import { TestsController } from './controllers/tests.controller';

@Module({
  imports: [
    JobsModule,
    ResultsModule,
    ParseModule,
    MongooseModule.forFeature([
      { name: TestSet.name, schema: TestSetSchema },
      { name: TestCase.name, schema: TestCaseSchema },
    ]),
  ],
  controllers: [TestsController],
  providers: [
    BotClientService,
    ScoreService,
    FollowupService,
    ConvertService,
    TestsService,
  ],
  exports: [
    MongooseModule,
    BotClientService,
    ScoreService,
    FollowupService,
    TestsService,
  ],
})
export class TestsModule {}

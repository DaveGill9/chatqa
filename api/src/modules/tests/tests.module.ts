import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestSet, TestSetSchema } from './entities/test-set.entity';
import { TestCase, TestCaseSchema } from './entities/test-case.entity';
import { TestRun, TestRunSchema } from './entities/test-run.entity';
import { Result, ResultSchema } from './entities/result.entity';
import { ResultSet, ResultSetSchema } from './entities/result-set.entity';
import { ResultCase, ResultCaseSchema } from './entities/result-case.entity';
import { ParserService } from './services/parser.service';
import { BotClientService } from './services/bot-client.service';
import { ScoreService } from './services/score.service';
import { FollowupService } from './services/followup.service';
import { ConvertService } from './services/convert.service';
import { TestsService } from './services/tests.service';
import { TestsController } from './controllers/tests.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestSet.name, schema: TestSetSchema },
      { name: TestCase.name, schema: TestCaseSchema },
      { name: TestRun.name, schema: TestRunSchema },
      { name: Result.name, schema: ResultSchema },
      { name: ResultSet.name, schema: ResultSetSchema },
      { name: ResultCase.name, schema: ResultCaseSchema },
    ]),
  ],
  controllers: [TestsController],
  providers: [
    ParserService,
    BotClientService,
    ScoreService,
    FollowupService,
    ConvertService,
    TestsService,
  ],
  exports: [
    MongooseModule,
    ParserService,
    BotClientService,
    ScoreService,
    FollowupService,
    TestsService,
  ],
})
export class TestsModule {}

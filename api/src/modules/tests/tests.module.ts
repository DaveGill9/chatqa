import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestSet, TestSetSchema } from './entities/test-set.entity';
import { TestCase, TestCaseSchema } from './entities/test-case.entity';
import { TestRun, TestRunSchema } from './entities/test-run.entity';
import { Result, ResultSchema } from './entities/result.entity';
import { ParserService } from './services/parser.service';
import { BotClientService } from './services/bot-client.service';
import { ScoreService } from './services/score.service';
import { TestsService } from './services/tests.service';
import { TestsController } from './controllers/tests.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestSet.name, schema: TestSetSchema },
      { name: TestCase.name, schema: TestCaseSchema },
      { name: TestRun.name, schema: TestRunSchema },
      { name: Result.name, schema: ResultSchema },
    ]),
  ],
  controllers: [TestsController],
  providers: [ParserService, BotClientService, ScoreService, TestsService],
  exports: [MongooseModule, ParserService, BotClientService, ScoreService, TestsService],
})
export class TestsModule {}

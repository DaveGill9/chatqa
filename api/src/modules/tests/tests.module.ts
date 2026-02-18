import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TestSet, TestSetSchema } from './entities/test-set.entity';
import { TestCase, TestCaseSchema } from './entities/test-case.entity';
import { TestRun, TestRunSchema } from './entities/test-run.entity';
import { Result, ResultSchema } from './entities/result.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TestSet.name, schema: TestSetSchema },
      { name: TestCase.name, schema: TestCaseSchema },
      { name: TestRun.name, schema: TestRunSchema },
      { name: Result.name, schema: ResultSchema },
    ]),
  ],
  controllers: [],
  providers: [],
  exports: [MongooseModule],
})
export class TestsModule {}

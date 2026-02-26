import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParseModule } from '../parse/parse.module';
import { ResultSet, ResultSetSchema } from './entities/result-set.entity';
import { ResultCase, ResultCaseSchema } from './entities/result-case.entity';
import {
  ResultSetEvaluation,
  ResultSetEvaluationSchema,
} from './entities/result-set-evaluation.entity';
import { EvaluateService } from './services/evaluate.service';
import { ResultsService } from './services/results.service';
import { ResultsController } from './controllers/results.controller';

@Module({
  imports: [
    ParseModule,
    MongooseModule.forFeature([
      { name: ResultSet.name, schema: ResultSetSchema },
      { name: ResultCase.name, schema: ResultCaseSchema },
      { name: ResultSetEvaluation.name, schema: ResultSetEvaluationSchema },
    ]),
  ],
  controllers: [ResultsController],
  providers: [EvaluateService, ResultsService],
  exports: [
    MongooseModule,
    EvaluateService,
    ResultsService,
  ],
})
export class ResultsModule {}

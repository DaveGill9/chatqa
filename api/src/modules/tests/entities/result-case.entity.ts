import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type ResultCaseDocument = HydratedDocument<ResultCase>;

@Schema({
  timestamps: true,
  collection: 'result-cases',
})
export class ResultCase extends BaseEntity {
  @Prop({ required: true, index: true })
  resultSetId: string;

  @Prop({ required: true, index: true })
  testRunId: string;

  @Prop({ required: true, index: true })
  testSetId: string;

  @Prop({ required: true, index: true })
  testCaseId: string;

  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  input: string;

  @Prop({ required: true })
  expected: string;

  @Prop({ default: '' })
  actual: string;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: '' })
  reasoning: string;

  @Prop({ type: Object })
  additionalContext?: Record<string, unknown>;
}

export const ResultCaseSchema = SchemaFactory.createForClass(ResultCase);

ResultCaseSchema.index({ resultSetId: 1, id: 1 }, { unique: true });
ResultCaseSchema.index({ testRunId: 1, testCaseId: 1 });


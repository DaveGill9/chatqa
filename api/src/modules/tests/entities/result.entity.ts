import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type ResultDocument = HydratedDocument<Result>;

@Schema({
  timestamps: true,
  collection: 'results',
})
export class Result extends BaseEntity {
  @Prop({ required: true, index: true })
  testRunId: string;

  @Prop({ required: true, index: true })
  testCaseId: string;

  @Prop({ default: '' })
  actual: string;

  @Prop({ default: 0 })
  score: number;

  @Prop({ default: '' })
  reasoning: string;
}

export const ResultSchema = SchemaFactory.createForClass(Result);

ResultSchema.index({ testRunId: 1, testCaseId: 1 }, { unique: true });

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type TestCaseDocument = HydratedDocument<TestCase>;

@Schema({
  timestamps: true,
  collection: 'test-cases',
})
export class TestCase extends BaseEntity {
  @Prop({ required: true, index: true })
  testSetId: string;

  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  input: string;

  @Prop({ required: true })
  expected: string;

  @Prop({ type: Object })
  additionalContext?: Record<string, unknown>;
}

export const TestCaseSchema = SchemaFactory.createForClass(TestCase);

TestCaseSchema.index({ testSetId: 1, id: 1 }, { unique: true });

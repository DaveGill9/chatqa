import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type TestRunDocument = HydratedDocument<TestRun>;

@Schema({
  timestamps: true,
  collection: 'test-runs',
})
export class TestRun extends BaseEntity {
  @Prop({ required: true, index: true })
  testSetId: string;

  @Prop({ required: true, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' })
  status: string;

  @Prop()
  completedAt?: Date;
}

export const TestRunSchema = SchemaFactory.createForClass(TestRun);

TestRunSchema.index({ testSetId: 1 });
TestRunSchema.index({ createdAt: -1 });

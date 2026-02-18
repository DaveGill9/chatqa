import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type TestSetDocument = HydratedDocument<TestSet>;

@Schema({
  timestamps: true,
  collection: 'test-sets',
})
export class TestSet extends BaseEntity {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  filename: string;

  @Prop({ trim: true })
  project?: string;
}

export const TestSetSchema = SchemaFactory.createForClass(TestSet);

TestSetSchema.index({ createdAt: -1 });

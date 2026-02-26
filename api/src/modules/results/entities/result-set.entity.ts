import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type ResultSetDocument = HydratedDocument<ResultSet>;

@Schema({
  timestamps: true,
  collection: 'result-sets',
})
export class ResultSet extends BaseEntity {
  @Prop({ required: true, index: true })
  testSetId: string;

  @Prop({ required: true, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' })
  status: string;

  @Prop()
  completedAt?: Date;

  @Prop()
  rowCount?: number;

  @Prop()
  resultSizeBytesXlsx?: number;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  filename: string;

  @Prop({ required: true, enum: ['csv', 'xlsx'] })
  format: 'csv' | 'xlsx';

  @Prop()
  sizeBytes?: number;

  @Prop()
  testCaseCount?: number;

  @Prop({ trim: true })
  testSetName?: string;

  @Prop({ trim: true })
  testSetFilename?: string;
}

export const ResultSetSchema = SchemaFactory.createForClass(ResultSet);

ResultSetSchema.index({ createdAt: -1 });
ResultSetSchema.index({ testSetId: 1, createdAt: -1 });

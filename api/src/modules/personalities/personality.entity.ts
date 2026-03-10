import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { BaseEntity } from 'src/types/base-entity.type';

export type PersonalityDocument = HydratedDocument<Personality>;

@Schema({
  timestamps: true,
  collection: 'personalities',
})
export class Personality extends BaseEntity {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ trim: true, maxlength: 255 })
  description?: string;

  @Prop({ required: true, trim: true, maxlength: 4000 })
  instructions: string;
}

export const PersonalitySchema = SchemaFactory.createForClass(Personality);

PersonalitySchema.index({ name: 1 });
PersonalitySchema.index({ createdAt: -1 });
PersonalitySchema.index({ name: 'text', description: 'text' });

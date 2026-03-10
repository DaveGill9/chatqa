import { Prop } from '@nestjs/mongoose';
import { generateId } from '../utils/nanoid';

export class BaseEntity {
    @Prop({ required: true, default: () => generateId() })
    _id: string;
    createdAt?: Date;
    updatedAt?: Date;
};
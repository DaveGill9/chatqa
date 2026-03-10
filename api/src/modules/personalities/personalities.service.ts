import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Projection } from 'src/types/projection.type';
import { Personality, PersonalityDocument } from './personality.entity';
import {
  CreatePersonality,
  FindPersonalitiesFilter,
  UpdatePersonality,
} from './personality.types';

@Injectable()
export class PersonalitiesService {
  constructor(
    @InjectModel(Personality.name)
    private readonly personalityModel: Model<PersonalityDocument>,
  ) {}

  async createOne(data: CreatePersonality): Promise<Personality> {
    const personality = new this.personalityModel(data);
    return await personality.save();
  }

  async findOne<T>(id: string, select?: Projection): Promise<T | null> {
    const filter = { _id: { $eq: id } };
    return await this.personalityModel.findOne(filter).select(select || {}).lean<T>();
  }

  async findMany<T>(filter: FindPersonalitiesFilter, select?: Projection): Promise<T[]> {
    const criteria: Record<string, unknown> = {};

    if (filter.keywords) {
      criteria.$text = { $search: filter.keywords };
    }

    return await this.personalityModel
      .find(criteria)
      .select(select || {})
      .sort({ name: 1, createdAt: -1 })
      .skip(filter.offset || 0)
      .limit(filter.limit || 50)
      .lean<T[]>();
  }

  async updateOne(id: string, data: UpdatePersonality): Promise<Personality> {
    const personality = await this.personalityModel
      .findOneAndUpdate({ _id: { $eq: id } }, data, {
        new: true,
        runValidators: true,
      })
      .lean<Personality | null>();

    if (!personality) {
      throw new NotFoundException('Personality not found');
    }

    return personality;
  }

  async deleteOne(id: string): Promise<void> {
    const result = await this.personalityModel.deleteOne({ _id: { $eq: id } });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Personality not found');
    }
  }
}

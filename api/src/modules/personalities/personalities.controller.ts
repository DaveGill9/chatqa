import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from 'src/pipes/zod-validation.pipe';
import { IdParamSchema } from 'src/types/id-param.type';
import type { IdParam } from 'src/types/id-param.type';
import type { Personality } from './personality.entity';
import {
  CreatePersonalitySchema,
  FindPersonalitiesFilterSchema,
  UpdatePersonalitySchema,
} from './personality.types';
import type {
  CreatePersonality,
  FindPersonalitiesFilter,
  UpdatePersonality,
} from './personality.types';
import { PersonalitiesService } from './personalities.service';

@Controller('personalities')
export class PersonalitiesController {
  constructor(private readonly personalitiesService: PersonalitiesService) {}

  @Get()
  async findMany(
    @Query(new ZodValidationPipe(FindPersonalitiesFilterSchema))
    filter: FindPersonalitiesFilter,
  ): Promise<Personality[]> {
    return await this.personalitiesService.findMany<Personality>(filter);
  }

  @Get(':id')
  async findOne(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParam,
  ): Promise<Personality | null> {
    return await this.personalitiesService.findOne<Personality>(params.id);
  }

  @Post()
  async createOne(
    @Body(new ZodValidationPipe(CreatePersonalitySchema))
    payload: CreatePersonality,
  ): Promise<Personality> {
    return await this.personalitiesService.createOne(payload);
  }

  @Patch(':id')
  async updateOne(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(UpdatePersonalitySchema))
    payload: UpdatePersonality,
  ): Promise<Personality> {
    return await this.personalitiesService.updateOne(params.id, payload);
  }

  @Delete(':id')
  async deleteOne(
    @Param(new ZodValidationPipe(IdParamSchema)) params: IdParam,
  ): Promise<void> {
    await this.personalitiesService.deleteOne(params.id);
  }
}

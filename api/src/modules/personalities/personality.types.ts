import { z } from 'zod';

export const CreatePersonalitySchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional(),
  instructions: z.string().trim().min(1).max(4000),
});

export type CreatePersonality = z.infer<typeof CreatePersonalitySchema>;

export const UpdatePersonalitySchema = CreatePersonalitySchema.partial().refine(
  payload => Object.keys(payload).length > 0,
  {
    message: 'At least one field is required',
  },
);

export type UpdatePersonality = z.infer<typeof UpdatePersonalitySchema>;

export const FindPersonalitiesFilterSchema = z.object({
  keywords: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type FindPersonalitiesFilter = z.infer<typeof FindPersonalitiesFilterSchema>;

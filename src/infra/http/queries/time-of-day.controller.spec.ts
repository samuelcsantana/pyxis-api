import type { FastifyRequest } from 'fastify';
import type { Project } from '../../../domain/entities/project.entity';
import { weekdayHours } from '../../../domain/queries/time-of-day';
import type { GetTimeOfDayUseCase } from '../../../usecases/queries/get-time-of-day.usecase';
import { TimeOfDayController } from './time-of-day.controller';
import { timeOfDayReportSchema } from './time-of-day.schemas';

const PROJECT: Project = {
  id: '6f1d3c2a-8b4e-4f7a-9c1d-2e3f4a5b6c7d',
  name: 'Shop',
  allowedOrigins: ['https://shop.example.com'],
  timezone: 'UTC',
  conversionEvent: null,
  createdAt: new Date('2026-10-01T00:00:00.000Z'),
};
const RANGE = { from: '2026-10-04', to: '2026-10-05' };

describe('TimeOfDayController', () => {
  it('asks for the range of the project and answers the week of hours in the contract shape', async () => {
    const calls: unknown[][] = [];
    const useCase = {
      execute: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(weekdayHours([{ weekday: 7, hour: 21, visits: 3 }]));
      },
    };
    const controller = new TimeOfDayController(useCase as unknown as GetTimeOfDayUseCase);

    const body = await controller.timeOfDay({ project: PROJECT } as FastifyRequest, RANGE);

    expect(calls).toEqual([[PROJECT, RANGE]]);
    const parsed = timeOfDayReportSchema.parse(body);
    expect(parsed.weekdays).toHaveLength(7);
    expect(parsed.weekdays[6]).toMatchObject({ weekday: 7 });
    expect(parsed.weekdays[6]?.hours[21]).toBe(3);
  });
});

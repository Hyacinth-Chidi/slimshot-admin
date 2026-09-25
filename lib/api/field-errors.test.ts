import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { fieldErrors } from './field-errors';

describe('fieldErrors', () => {
  it('maps a 422 details object onto field messages', () => {
    const err = new ApiError(
      {
        code: 'UNPROCESSABLE',
        message: 'Validation failed.',
        details: { value: ['must be at least 32 characters'] },
        traceId: 't',
      },
      422,
    );
    expect(fieldErrors(err)).toEqual({ value: 'must be at least 32 characters' });
  });

  it('joins multiple messages for one field', () => {
    const err = new ApiError(
      {
        code: 'UNPROCESSABLE',
        message: 'Validation failed.',
        details: { name: ['too short', 'must be unique'] },
        traceId: 't',
      },
      422,
    );
    expect(fieldErrors(err).name).toBe('too short, must be unique');
  });

  it('returns nothing for a non-422, so a 409 still reaches its own handler', () => {
    const err = new ApiError({ code: 'CONFLICT', message: 'in use', traceId: 't' }, 409);
    expect(fieldErrors(err)).toEqual({});
  });

  it('returns nothing when a 422 carries no details', () => {
    // The API may reject without a per-field breakdown. Reading .details
    // unguarded would throw and lose the toast as well as the field hints.
    const err = new ApiError({ code: 'UNPROCESSABLE', message: 'bad', traceId: 't' }, 422);
    expect(fieldErrors(err)).toEqual({});
  });
});

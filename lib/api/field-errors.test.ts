import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { fieldErrors, validationSummary } from './field-errors';

function unprocessable(details?: unknown, message = 'Request validation failed.') {
  return new ApiError(
    { code: 'VALIDATION_FAILED', message, ...(details !== undefined ? { details } : {}), traceId: 't' },
    422,
  );
}

describe('fieldErrors', () => {
  // The server's exception filter (http-exception.filter.ts:75-80) sends a
  // class-validator 422's `details` as a flat string[] of messages, each
  // starting with the offending property's name.
  it("maps the server's string[] details onto the field each message names", () => {
    const err = unprocessable(['name must be shorter than or equal to 80 characters']);
    expect(fieldErrors(err)).toEqual({
      name: 'name must be shorter than or equal to 80 characters',
    });
  });

  it('joins multiple messages for one field and keeps other fields separate', () => {
    const err = unprocessable([
      'name must be shorter than or equal to 80 characters',
      'name must be a string',
      'kind must be one of the following values: audio',
    ]);
    expect(fieldErrors(err)).toEqual({
      name: 'name must be shorter than or equal to 80 characters, name must be a string',
      kind: 'kind must be one of the following values: audio',
    });
  });

  it('attributes a whitelist rejection ("property X should not exist") to X', () => {
    const err = unprocessable(['property colour should not exist']);
    expect(fieldErrors(err)).toEqual({ colour: 'property colour should not exist' });
  });

  it('still accepts a { field: string[] } object, for forward-compatibility', () => {
    const err = unprocessable({ value: ['must be at least 32 characters'] });
    expect(fieldErrors(err)).toEqual({ value: 'must be at least 32 characters' });
  });

  it('returns nothing for a non-422, so a 409 still reaches its own handler', () => {
    // A P2002 409 also carries details (the unique target's columns); it must
    // not be read as field messages.
    const err = new ApiError(
      { code: 'CONFLICT', message: 'in use', details: ['slug'], traceId: 't' },
      409,
    );
    expect(fieldErrors(err)).toEqual({});
  });

  it('returns nothing when a 422 carries no details', () => {
    // The API may reject without a per-field breakdown (a plain
    // UnprocessableEntityException). Reading .details unguarded would throw
    // and lose the toast as well as the field hints.
    expect(fieldErrors(unprocessable())).toEqual({});
  });

  it('returns nothing for details of an unexpected shape', () => {
    expect(fieldErrors(unprocessable('oops'))).toEqual({});
    expect(fieldErrors(unprocessable(42))).toEqual({});
  });

  it('returns nothing for a non-ApiError', () => {
    expect(fieldErrors(new Error('boom'))).toEqual({});
  });
});

describe('validationSummary', () => {
  it("joins the server's messages, since the envelope message alone says nothing useful", () => {
    const err = unprocessable(['kind must be one of the following values: audio', 'parentId must be a string']);
    expect(validationSummary(err)).toBe(
      'kind must be one of the following values: audio, parentId must be a string',
    );
  });

  it("falls back to the error's own message when there are no details", () => {
    expect(validationSummary(unprocessable(undefined, 'Value too short.'))).toBe('Value too short.');
  });

  it('flattens a { field: string[] } object too', () => {
    expect(validationSummary(unprocessable({ value: ['too short'] }))).toBe('too short');
  });
});

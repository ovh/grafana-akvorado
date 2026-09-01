import { MyQuery } from './types';

/* Akvorado refuses a limit above its own dimensionsLimit. 50 is the value the
   console ships with, and getConfiguration() reports the real one. */
export const DEFAULT_MAX_LIMIT = 50;
export const MAX_TRUNCATE_V4 = 32;
export const MAX_TRUNCATE_V6 = 128;

export const SANKEY_DIMENSIONS_ERROR = "At least two dimensions are required for 'sankey' type queries.";

export interface QueryErrors {
  dimensions?: string;
  limit?: string;
  truncatev4?: string;
  truncatev6?: string;
}

/*
A dashboard holds these values as a string or as a number. A value the query
cannot use gets a warning, never a silent default: the query editor shows it
next to the field and the query does not run until it is fixed.
*/
export function numberFieldError(
  label: string,
  value: string | number | undefined,
  min: number,
  max: number
): string | undefined {
  const text = String(value ?? '').trim();
  if (text === '') {
    return `${label} is required.`;
  }
  if (text.startsWith('$')) {
    /* A template variable resolves at query time. */
    return undefined;
  }
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) {
    return `${label} must be a whole number.`;
  }
  if (parsed < min || parsed > max) {
    return `${label} must be between ${min} and ${max}.`;
  }
  return undefined;
}

export function validateQuery(query: MyQuery, opts: { maxLimit: number; withTruncate: boolean }): QueryErrors {
  const errors: QueryErrors = {};

  if (query.type === 'sankey' && (query.dimensions?.length ?? 0) < 2) {
    errors.dimensions = SANKEY_DIMENSIONS_ERROR;
  }

  const limit = numberFieldError('Limit', query.limit, 1, opts.maxLimit);
  if (limit) {
    errors.limit = limit;
  }

  /* The two truncate fields only reach the query when a dimension carries an
     address, so they only get checked then. */
  if (opts.withTruncate) {
    const v4 = numberFieldError('IPv4 /x', query.truncatev4, 0, MAX_TRUNCATE_V4);
    if (v4) {
      errors.truncatev4 = v4;
    }
    const v6 = numberFieldError('IPv6 /x', query.truncatev6, 0, MAX_TRUNCATE_V6);
    if (v6) {
      errors.truncatev6 = v6;
    }
  }

  return errors;
}

export function firstError(errors: QueryErrors): string | undefined {
  return errors.dimensions ?? errors.limit ?? errors.truncatev4 ?? errors.truncatev6;
}

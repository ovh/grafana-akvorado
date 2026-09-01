import { DEFAULT_MAX_LIMIT, firstError, numberFieldError, validateQuery } from './queryValidation';
import { MyQuery } from './types';

const baseQuery: MyQuery = {
  refId: 'A',
  type: 'timeseries',
  limit: '10',
  truncatev4: '32',
  truncatev6: '128',
  topType: 'avg',
  unit: 'l3bps',
  dimensions: ['SrcAS'],
  error: undefined,
};

describe('numberFieldError', () => {
  it('accepts a number and a numeric string alike', () => {
    expect(numberFieldError('Limit', 10, 1, 50)).toBeUndefined();
    expect(numberFieldError('Limit', '10', 1, 50)).toBeUndefined();
    expect(numberFieldError('Limit', ' 10 ', 1, 50)).toBeUndefined();
  });

  it('warns instead of falling back when the box is empty', () => {
    expect(numberFieldError('Limit', '', 1, 50)).toBe('Limit is required.');
    expect(numberFieldError('Limit', undefined, 1, 50)).toBe('Limit is required.');
  });

  it('warns when the value is not a whole number', () => {
    expect(numberFieldError('Limit', 'abc', 1, 50)).toBe('Limit must be a whole number.');
    expect(numberFieldError('Limit', '10.5', 1, 50)).toBe('Limit must be a whole number.');
  });

  it('warns when the value is out of range', () => {
    expect(numberFieldError('Limit', '0', 1, 50)).toBe('Limit must be between 1 and 50.');
    expect(numberFieldError('Limit', '51', 1, 50)).toBe('Limit must be between 1 and 50.');
    expect(numberFieldError('IPv4 prefix length', '33', 0, 32)).toBe('IPv4 prefix length must be between 0 and 32.');
  });

  it('leaves a template variable to the query time', () => {
    expect(numberFieldError('Limit', '$limit', 1, 50)).toBeUndefined();
  });
});

describe('validateQuery', () => {
  it('reports nothing for a valid query', () => {
    expect(validateQuery(baseQuery, { maxLimit: DEFAULT_MAX_LIMIT, withTruncate: false })).toEqual({});
  });

  it('reports the limit', () => {
    const errors = validateQuery({ ...baseQuery, limit: '' }, { maxLimit: DEFAULT_MAX_LIMIT, withTruncate: false });
    expect(errors.limit).toBe('Limit is required.');
    expect(firstError(errors)).toBe('Limit is required.');
  });

  it('checks the truncate fields only when a dimension carries an address', () => {
    const broken = { ...baseQuery, truncatev4: '99', truncatev6: '999' };
    expect(validateQuery(broken, { maxLimit: DEFAULT_MAX_LIMIT, withTruncate: false })).toEqual({});
    const errors = validateQuery(broken, { maxLimit: DEFAULT_MAX_LIMIT, withTruncate: true });
    expect(errors.truncatev4).toBe('IPv4 prefix length must be between 0 and 32.');
    expect(errors.truncatev6).toBe('IPv6 prefix length must be between 0 and 128.');
  });

  it('keeps the sankey dimensions rule, and reports it first', () => {
    const errors = validateQuery(
      { ...baseQuery, type: 'sankey', dimensions: ['SrcAS'], limit: '' },
      { maxLimit: DEFAULT_MAX_LIMIT, withTruncate: false }
    );
    expect(errors.dimensions).toBe("At least two dimensions are required for 'sankey' type queries.");
    expect(firstError(errors)).toBe(errors.dimensions);
  });

  it('honours the limit the akvorado configuration reports', () => {
    expect(validateQuery({ ...baseQuery, limit: '20' }, { maxLimit: 10, withTruncate: false }).limit).toBe(
      'Limit must be between 1 and 10.'
    );
  });
});

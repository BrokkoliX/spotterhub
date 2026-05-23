import { describe, expect, it } from 'vitest';

import { buildPaginationArgs } from '../utils/resolverHelpers.js';

describe('buildPaginationArgs', () => {
  it('defaults to take=20 when first is omitted', () => {
    const { skip, take, isOffset } = buildPaginationArgs({});
    expect(skip).toBe(0);
    expect(take).toBe(20);
    expect(isOffset).toBe(false);
  });

  it('caps take at the default max of 50 when first exceeds it', () => {
    const { take } = buildPaginationArgs({ first: 10000 });
    expect(take).toBe(50);
  });

  it('respects a custom maxTake when the resolver opts in', () => {
    const { take } = buildPaginationArgs({ first: 10000, maxTake: 10000 });
    expect(take).toBe(10000);
  });

  it('still honours first when first is below maxTake', () => {
    const { take } = buildPaginationArgs({ first: 100, maxTake: 10000 });
    expect(take).toBe(100);
  });

  it('computes offset skip from page using the resolved take', () => {
    const { skip, take, isOffset } = buildPaginationArgs({
      first: 25,
      page: 3,
    });
    expect(take).toBe(25);
    expect(skip).toBe(50);
    expect(isOffset).toBe(true);
  });

  it('caps page-based take at maxTake when first overshoots', () => {
    const { skip, take, isOffset } = buildPaginationArgs({
      first: 10000,
      page: 2,
      maxTake: 10000,
    });
    expect(take).toBe(10000);
    expect(skip).toBe(10000);
    expect(isOffset).toBe(true);
  });
});

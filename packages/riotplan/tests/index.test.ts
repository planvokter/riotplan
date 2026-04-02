/**
 * Tests for RiotPlan exports
 */

import { describe, it, expect } from 'vitest';
import {
  VERSION,
  PLAN_CONVENTIONS,
} from '../src/index.js';

describe('VERSION', () => {
  it('should export version string', () => {
    expect(VERSION).toBe('0.0.1');
  });
});

describe('PLAN_CONVENTIONS export', () => {
  it('should export PLAN_CONVENTIONS from types', () => {
    expect(PLAN_CONVENTIONS).toBeDefined();
    expect(PLAN_CONVENTIONS.standardFiles).toBeDefined();
  });
});

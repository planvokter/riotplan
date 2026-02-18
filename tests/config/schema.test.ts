/**
 * Tests for RiotPlan configuration schema
 */

import { describe, it, expect } from 'vitest';
import { RiotPlanConfigSchema } from '../../src/config/schema.js';

describe('RiotPlanConfigSchema', () => {
    describe('valid configurations', () => {
        it('should accept config with all fields', () => {
            const config = {
                planDirectory: './my-plans',
                defaultProvider: 'anthropic' as const,
                defaultModel: 'claude-3-5-sonnet-20241022',
                templateDirectory: './templates',
                catalysts: ['catalyst1', 'catalyst2'],
                catalystDirectory: './catalysts',
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.planDirectory).toBe('./my-plans');
            expect(result.defaultProvider).toBe('anthropic');
            expect(result.defaultModel).toBe('claude-3-5-sonnet-20241022');
            expect(result.templateDirectory).toBe('./templates');
            expect(result.catalysts).toEqual(['catalyst1', 'catalyst2']);
            expect(result.catalystDirectory).toBe('./catalysts');
        });

        it('should accept config with only planDirectory', () => {
            const config = {
                planDirectory: './plans',
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.planDirectory).toBe('./plans');
            expect(result.defaultProvider).toBeUndefined();
            expect(result.defaultModel).toBeUndefined();
            expect(result.templateDirectory).toBeUndefined();
            expect(result.catalysts).toBeUndefined();
            expect(result.catalystDirectory).toBeUndefined();
        });

        it('should apply default value for planDirectory when not provided', () => {
            const config = {};

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.planDirectory).toBe('./plans');
        });

        it('should accept valid provider values', () => {
            const providers = ['anthropic', 'openai', 'gemini'] as const;

            for (const provider of providers) {
                const config = {
                    planDirectory: './plans',
                    defaultProvider: provider,
                };

                const result = RiotPlanConfigSchema.parse(config);
                expect(result.defaultProvider).toBe(provider);
            }
        });
    });

    describe('invalid configurations', () => {
        it('should reject invalid provider value', () => {
            const config = {
                planDirectory: './plans',
                defaultProvider: 'invalid-provider',
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });

        it('should reject non-string planDirectory', () => {
            const config = {
                planDirectory: 123,
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });

        it('should reject non-string defaultModel', () => {
            const config = {
                planDirectory: './plans',
                defaultModel: 123,
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });

        it('should reject non-string templateDirectory', () => {
            const config = {
                planDirectory: './plans',
                templateDirectory: 123,
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });

        it('should reject non-array catalysts', () => {
            const config = {
                planDirectory: './plans',
                catalysts: 'not-an-array',
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });

        it('should reject non-string catalyst entries', () => {
            const config = {
                planDirectory: './plans',
                catalysts: [123, 'valid'],
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });

        it('should reject non-string catalystDirectory', () => {
            const config = {
                planDirectory: './plans',
                catalystDirectory: 123,
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });
    });

    describe('optional fields', () => {
        it('should allow undefined optional fields', () => {
            const config = {
                planDirectory: './plans',
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.defaultProvider).toBeUndefined();
            expect(result.defaultModel).toBeUndefined();
            expect(result.templateDirectory).toBeUndefined();
            expect(result.catalysts).toBeUndefined();
            expect(result.catalystDirectory).toBeUndefined();
        });

        it('should allow empty config object (uses defaults)', () => {
            const config = {};

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.planDirectory).toBe('./plans');
        });

        it('should accept empty catalysts array', () => {
            const config = {
                planDirectory: './plans',
                catalysts: [],
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.catalysts).toEqual([]);
        });

        it('should accept catalysts without catalystDirectory', () => {
            const config = {
                planDirectory: './plans',
                catalysts: ['catalyst1'],
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.catalysts).toEqual(['catalyst1']);
            expect(result.catalystDirectory).toBeUndefined();
        });

        it('should accept catalystDirectory without catalysts', () => {
            const config = {
                planDirectory: './plans',
                catalystDirectory: './catalysts',
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.catalysts).toBeUndefined();
            expect(result.catalystDirectory).toBe('./catalysts');
        });
    });

    describe('verification configuration', () => {
        it('should apply default verification settings when not provided', () => {
            const config = {};

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.verification).toBeDefined();
            expect(result.verification.enforcement).toBe('interactive');
            expect(result.verification.checkAcceptanceCriteria).toBe(true);
            expect(result.verification.checkArtifacts).toBe(false);
            expect(result.verification.autoRetrospective).toBe(true);
            expect(result.verification.requireEvidence).toBe(false);
        });

        it('should accept custom verification settings', () => {
            const config = {
                verification: {
                    enforcement: 'strict' as const,
                    checkAcceptanceCriteria: false,
                    checkArtifacts: true,
                    autoRetrospective: false,
                    requireEvidence: true,
                },
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.verification.enforcement).toBe('strict');
            expect(result.verification.checkAcceptanceCriteria).toBe(false);
            expect(result.verification.checkArtifacts).toBe(true);
            expect(result.verification.autoRetrospective).toBe(false);
            expect(result.verification.requireEvidence).toBe(true);
        });

        it('should accept valid enforcement levels', () => {
            const levels = ['advisory', 'interactive', 'strict'] as const;

            for (const level of levels) {
                const config = {
                    verification: {
                        enforcement: level,
                    },
                };

                const result = RiotPlanConfigSchema.parse(config);
                expect(result.verification.enforcement).toBe(level);
            }
        });

        it('should reject invalid enforcement level', () => {
            const config = {
                verification: {
                    enforcement: 'invalid',
                },
            };

            expect(() => {
                RiotPlanConfigSchema.parse(config);
            }).toThrow();
        });

        it('should accept partial verification config with defaults', () => {
            const config = {
                verification: {
                    enforcement: 'advisory' as const,
                },
            };

            const result = RiotPlanConfigSchema.parse(config);
            expect(result.verification.enforcement).toBe('advisory');
            expect(result.verification.checkAcceptanceCriteria).toBe(true);
            expect(result.verification.checkArtifacts).toBe(false);
        });
    });
});

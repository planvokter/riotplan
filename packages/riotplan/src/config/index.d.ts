/**
 * Configuration Module for RiotPlan
 *
 * This module provides the public API for RiotPlan configuration management.
 * It integrates with CardiganTime for configuration loading and validation,
 * and provides a unified interface for accessing configuration values.
 *
 * Configuration resolution follows a four-tier strategy:
 * 1. Environment variable (RIOTPLAN_PLAN_DIRECTORY) - highest priority
 * 2. Configuration file (riotplan.config.*, .riotplan/config.*, etc.)
 * 3. Walk-up detection (find existing plans/ directory)
 * 4. Fallback to ./plans in current directory
 */
export type { RiotPlanConfig } from './types.js';
export { RiotPlanConfigSchema } from './schema.js';
export { loadConfig, clearConfigCache, checkConfigWithCardiganTime } from './loader.js';
export { findPlansDirectory, clearWalkUpCache } from './walk-up.js';
export { resolvePlanDirectory, resolvePlanDirectorySync, clearResolverCache, } from './resolver.js';
export { loadConfiguredCatalysts, clearCatalystCache, getCatalystEnvOverrides, } from './catalyst-loader.js';
//# sourceMappingURL=index.d.ts.map
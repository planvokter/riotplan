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
// Re-export schema for validation
export { RiotPlanConfigSchema } from './schema.js';
// Export loader functions
export { loadConfig, clearConfigCache, checkConfigWithCardiganTime } from './loader.js';
// Export walk-up functions
export { findPlansDirectory, clearWalkUpCache } from './walk-up.js';
// Export resolver functions
export { resolvePlanDirectory, resolvePlanDirectorySync, clearResolverCache, } from './resolver.js';
// Export catalyst loader functions
export { loadConfiguredCatalysts, clearCatalystCache, getCatalystEnvOverrides, } from './catalyst-loader.js';
//# sourceMappingURL=index.js.map
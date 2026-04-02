/**
 * Main render function
 *
 * Render a plan to different formats.
 */

import type { Plan } from "../types.js";
import {
    renderToMarkdown,
    type MarkdownRenderOptions,
} from "./renderers/markdown.js";
import { renderToJson, type JsonRenderOptions } from "./renderers/json.js";
import { renderToHtml, type HtmlRenderOptions } from "./renderers/html.js";

/**
 * Supported render formats
 */
export type RenderFormat = "markdown" | "json" | "html";

/**
 * Render options (union of all format-specific options)
 */
export type RenderOptions = {
    /** Output format */
    format: RenderFormat;
} & Partial<MarkdownRenderOptions & JsonRenderOptions & HtmlRenderOptions>;

/**
 * Result of rendering a plan
 */
export interface RenderResult {
    /** Whether rendering succeeded */
    success: boolean;

    /** Rendered output content */
    content?: string;

    /** Output format */
    format?: RenderFormat;

    /** Error message if failed */
    error?: string;
}

/**
 * Render a plan to the specified format
 */
export function renderPlan(plan: Plan, options: RenderOptions): RenderResult {
    try {
        let content: string;

        switch (options.format) {
            case "markdown":
                content = renderToMarkdown(plan, options);
                break;

            case "json":
                content = renderToJson(plan, options);
                break;

            case "html":
                content = renderToHtml(plan, options);
                break;

            default:
                return {
                    success: false,
                    error: `Unknown format: ${String(options.format)}`,
                };
        }

        return {
            success: true,
            content,
            format: options.format,
        };
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown render error",
        };
    }
}

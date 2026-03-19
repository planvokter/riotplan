import { randomUUID } from "node:crypto";
import { createSqliteProvider } from "@kjerneverk/riotplan-format";

function appendBulletToSection(content: string, sectionHeading: string, bullet: string): string {
    const sectionIndex = content.indexOf(sectionHeading);
    if (sectionIndex === -1) {
        return `${content.trim()}\n\n${sectionHeading}\n\n- ${bullet}\n`;
    }

    const nextSectionIndex = content.indexOf("\n## ", sectionIndex + sectionHeading.length);
    const insertPoint = nextSectionIndex === -1 ? content.length : nextSectionIndex;
    return `${content.slice(0, insertPoint)}- ${bullet}\n${content.slice(insertPoint)}`;
}

function defaultIdeaContent(code: string): string {
    return `# Idea: ${code}

## Core Concept

## Why This Matters

## Initial Thoughts

## Constraints

## Questions

## Evidence
`;
}

export async function appendIdeaSectionBulletSqlite(input: {
    planPath: string;
    sectionHeading: string;
    bullet: string;
    eventType: string;
    eventData: Record<string, unknown>;
}): Promise<void> {
    const provider = createSqliteProvider(input.planPath);
    try {
        const [metaResult, filesResult] = await Promise.all([
            provider.getMetadata(),
            provider.getFiles(),
        ]);
        if (!metaResult.success || !metaResult.data) {
            throw new Error(metaResult.error || "Failed to read plan metadata");
        }
        const currentIdea = (filesResult.success ? filesResult.data || [] : [])
            .filter((f) => f.type === "idea")
            .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
        const base = currentIdea?.content || defaultIdeaContent(metaResult.data.id);
        const now = new Date().toISOString();
        const updated = appendBulletToSection(base, input.sectionHeading, input.bullet);

        const saveResult = await provider.saveFile({
            type: "idea",
            filename: currentIdea?.filename || "IDEA.md",
            content: updated,
            createdAt: currentIdea?.createdAt || now,
            updatedAt: now,
        });
        if (!saveResult.success) {
            throw new Error(saveResult.error || "Failed to persist IDEA.md");
        }

        const eventResult = await provider.addTimelineEvent({
            id: randomUUID(),
            timestamp: now,
            type: input.eventType as any,
            data: input.eventData,
        });
        if (!eventResult.success) {
            throw new Error(eventResult.error || `Failed to write event ${input.eventType}`);
        }
    } finally {
        await provider.close();
    }
}

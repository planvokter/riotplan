/**
 * Tests for RiotPlan CLI
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createProgram } from "../src/cli/cli.js";

// Read version from package.json to match CLI behavior
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJson = JSON.parse(
    readFileSync(join(__dirname, "../package.json"), "utf-8")
);
const EXPECTED_VERSION = packageJson.version;

describe("CLI", () => {
    describe("program setup", () => {
        it("should create program with correct name", () => {
            const program = createProgram();
            expect(program.name()).toBe("riotplan");
        });

        it("should have version", () => {
            const program = createProgram();
            expect(program.version()).toBe(EXPECTED_VERSION);
        });

        it("should have description", () => {
            const program = createProgram();
            expect(program.description()).toContain("workflow");
        });
    });

    describe("LLM-powered commands", () => {
        it("should have explore command", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("explore");
        });

        it("should have build-plan command", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("build-plan");
        });

        it("should have execute-plan command", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("execute-plan");
        });

        it("should have chat command", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("chat");
        });
    });

    describe("utility commands", () => {
        it("should have plan command group", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("plan");
        });

        it("should have status command", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("status");
        });

        it("should have step command group", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("step");
        });

        it("should have render command", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("render");
        });

        it("should have check-config command", () => {
            const program = createProgram();
            const commands = program.commands.map((c) => c.name());
            expect(commands).toContain("check-config");
        });
    });

    describe("plan subcommands", () => {
        it("should have init subcommand", () => {
            const program = createProgram();
            const planCmd = program.commands.find((c) => c.name() === "plan");
            expect(planCmd).toBeDefined();

            const subcommands = planCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("init");
        });

        it("should have validate subcommand", () => {
            const program = createProgram();
            const planCmd = program.commands.find((c) => c.name() === "plan");
            expect(planCmd).toBeDefined();

            const subcommands = planCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("validate");
        });
    });

    describe("step subcommands", () => {
        it("should have list subcommand", () => {
            const program = createProgram();
            const stepCmd = program.commands.find((c) => c.name() === "step");
            expect(stepCmd).toBeDefined();

            const subcommands = stepCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("list");
        });

        it("should have add subcommand", () => {
            const program = createProgram();
            const stepCmd = program.commands.find((c) => c.name() === "step");
            expect(stepCmd).toBeDefined();

            const subcommands = stepCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("add");
        });

        it("should have start subcommand", () => {
            const program = createProgram();
            const stepCmd = program.commands.find((c) => c.name() === "step");
            expect(stepCmd).toBeDefined();

            const subcommands = stepCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("start");
        });

        it("should have complete subcommand", () => {
            const program = createProgram();
            const stepCmd = program.commands.find((c) => c.name() === "step");
            expect(stepCmd).toBeDefined();

            const subcommands = stepCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("complete");
        });

        it("should have block subcommand", () => {
            const program = createProgram();
            const stepCmd = program.commands.find((c) => c.name() === "step");
            expect(stepCmd).toBeDefined();

            const subcommands = stepCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("block");
        });

        it("should have unblock subcommand", () => {
            const program = createProgram();
            const stepCmd = program.commands.find((c) => c.name() === "step");
            expect(stepCmd).toBeDefined();

            const subcommands = stepCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("unblock");
        });

        it("should have skip subcommand", () => {
            const program = createProgram();
            const stepCmd = program.commands.find((c) => c.name() === "step");
            expect(stepCmd).toBeDefined();

            const subcommands = stepCmd!.commands.map((c) => c.name());
            expect(subcommands).toContain("skip");
        });
    });

    describe("explore command options", () => {
        it("should have provider option", () => {
            const program = createProgram();
            const exploreCmd = program.commands.find((c) => c.name() === "explore");
            expect(exploreCmd).toBeDefined();

            const options = exploreCmd!.options.map((o) => o.long);
            expect(options).toContain("--provider");
        });

        it("should have model option", () => {
            const program = createProgram();
            const exploreCmd = program.commands.find((c) => c.name() === "explore");
            expect(exploreCmd).toBeDefined();

            const options = exploreCmd!.options.map((o) => o.long);
            expect(options).toContain("--model");
        });
    });

    describe("global options", () => {
        it("should have verbose option", () => {
            const program = createProgram();
            const options = program.options.map((o) => o.long);
            expect(options).toContain("--verbose");
        });

        it("should have json option", () => {
            const program = createProgram();
            const options = program.options.map((o) => o.long);
            expect(options).toContain("--json");
        });

        it("should have no-color option", () => {
            const program = createProgram();
            const options = program.options.map((o) => o.long);
            expect(options).toContain("--no-color");
        });
    });
});

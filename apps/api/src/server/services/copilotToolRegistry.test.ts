import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import {
  registerTool,
  getTool,
  listTools,
  listToolSpecsForProvider,
  __resetRegistryForTests,
} from "./copilotToolRegistry";

describe("copilotToolRegistry", () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });

  it("refuses to register a tool whose schema declares a userId parameter", () => {
    expect(() =>
      registerTool({
        name: "dangerous_tool",
        description: "should never register",
        parameters: z.object({ userId: z.string() }),
        jsonSchema: { type: "object", properties: { userId: { type: "string" } } },
        riskLevel: "LOW",
        execute: async () => ({}),
      })
    ).toThrow(/userId/);

    expect(getTool("dangerous_tool")).toBeUndefined();
  });

  it("registers a well-formed tool and makes it retrievable", () => {
    registerTool({
      name: "test_tool",
      description: "a test tool",
      parameters: z.object({ limit: z.number().optional() }),
      jsonSchema: { type: "object", properties: { limit: { type: "number" } } },
      riskLevel: "LOW",
      execute: async () => ({ ok: true }),
    });

    expect(getTool("test_tool")?.name).toBe("test_tool");
    expect(listTools()).toHaveLength(1);
  });

  it("throws on duplicate tool registration", () => {
    const tool = {
      name: "dup_tool",
      description: "d",
      parameters: z.object({}),
      jsonSchema: { type: "object", properties: {} },
      riskLevel: "LOW" as const,
      execute: async () => ({}),
    };
    registerTool(tool);
    expect(() => registerTool(tool)).toThrow(/already registered/);
  });

  it("exposes registered tools in the AIProvider tool-spec shape", () => {
    registerTool({
      name: "spec_tool",
      description: "described",
      parameters: z.object({}),
      jsonSchema: { type: "object", properties: {}, additionalProperties: false },
      riskLevel: "LOW",
      execute: async () => ({}),
    });

    const specs = listToolSpecsForProvider();
    expect(specs).toEqual([
      { name: "spec_tool", description: "described", parameters: { type: "object", properties: {}, additionalProperties: false } },
    ]);
  });

  it("getTool returns undefined for an unregistered name", () => {
    expect(getTool("nonexistent_tool")).toBeUndefined();
  });

  it("refuses to register a MEDIUM/HIGH-risk tool with no describeAction", () => {
    expect(() =>
      registerTool({
        name: "risky_no_description",
        description: "should never register",
        parameters: z.object({}),
        jsonSchema: { type: "object", properties: {} },
        riskLevel: "MEDIUM",
        execute: async () => ({}),
      })
    ).toThrow(/describeAction/);

    expect(getTool("risky_no_description")).toBeUndefined();
  });

  it("registers a MEDIUM-risk tool that does supply describeAction", () => {
    registerTool({
      name: "risky_with_description",
      description: "a write tool",
      parameters: z.object({}),
      jsonSchema: { type: "object", properties: {} },
      riskLevel: "MEDIUM",
      describeAction: () => "Do the risky thing?",
      execute: async () => ({}),
    });

    expect(getTool("risky_with_description")?.riskLevel).toBe("MEDIUM");
  });
});

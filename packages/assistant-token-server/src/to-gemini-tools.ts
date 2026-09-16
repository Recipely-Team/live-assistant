import type { ToolDefinition } from '@live-assistant/core';
import { toGeminiSchema } from './to-gemini-schema';

/**
 * Your `ToolDefinition`s in the shape Gemini takes as `tools`.
 *
 * @remarks
 * - **One rendering, two call sites.** The `bidiGenerateContentSetup` this
 *   package bakes into a token and an ordinary `generateContent` request accept
 *   the same `tools` array, so an app that has both a voice mode and a typed one
 *   declares its tools once and sends this in both places. The first integrator
 *   had a typed mode, could not reach this, and wrote the five lines again beside
 *   the ones in here — two renderings of one vocabulary, free to drift.
 * - **The wrapper is a single `functionDeclarations` group**, which is what the
 *   API expects for plain function tools; `toGeminiSchema` spells each schema's
 *   types the way it accepts them.
 */
export function toGeminiTools(tools: readonly ToolDefinition[]): Record<string, unknown>[] {
  return [
    {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        ...(tool.parameters !== undefined ? { parameters: toGeminiSchema(tool.parameters) } : {}),
      })),
    },
  ];
}

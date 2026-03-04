// SDK core
export { query, tool } from "./sdk.js";

// SDK types
export type {
	Query,
	QueryOptions,
	GCMessage,
	GCAssistantMessage,
	GCUserMessage,
	GCToolUseMessage,
	GCToolResultMessage,
	GCSystemMessage,
	GCStreamDelta,
	GCToolDefinition,
	GCHooks,
	GCHookResult,
	GCPreToolUseContext,
	GCHookContext,
} from "./sdk-types.js";

// Internal types (for advanced usage)
export type { AgentManifest, LoadedAgent } from "./loader.js";
export type { SkillMetadata } from "./skills.js";
export type { WorkflowMetadata } from "./workflows.js";
export type { SubAgentMetadata } from "./agents.js";
export type { ComplianceWarning } from "./compliance.js";
export type { EnvConfig } from "./config.js";

// Loader (escape hatch)
export { loadAgent } from "./loader.js";

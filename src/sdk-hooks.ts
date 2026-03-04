import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { GCHooks, GCPreToolUseContext } from "./sdk-types.js";

/**
 * Wraps a tool's execute function with programmatic SDK hook callbacks.
 * Mirrors the pattern in hooks.ts:wrapToolWithHooks() but uses in-process
 * callbacks instead of spawning shell scripts.
 */
export function wrapToolWithProgrammaticHooks(
	tool: AgentTool<any>,
	hooks: GCHooks,
	sessionId: string,
	agentName: string,
): AgentTool<any> {
	if (!hooks.preToolUse) return tool;

	const originalExecute = tool.execute;
	const preToolUse = hooks.preToolUse;

	return {
		...tool,
		execute: async (
			toolCallId: string,
			args: any,
			signal?: AbortSignal,
			onUpdate?: any,
		) => {
			const ctx: GCPreToolUseContext = {
				sessionId,
				agentName,
				event: "PreToolUse",
				toolName: tool.name,
				args,
			};

			const result = await preToolUse(ctx);

			if (result.action === "block") {
				throw new Error(
					`Tool "${tool.name}" blocked by hook: ${result.reason || "no reason given"}`,
				);
			}

			const finalArgs = result.action === "modify" && result.args
				? result.args
				: args;

			return originalExecute.call(tool, toolCallId, finalArgs, signal, onUpdate);
		},
	};
}

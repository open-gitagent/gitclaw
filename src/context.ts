import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { loadHistory } from "./voice/chat-history.js";
import type { ServerMessage } from "./voice/adapter.js";

/** Token estimate: ~4 chars per token */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** Truncate text to roughly maxTokens */
function truncateToTokens(text: string, maxTokens: number): string {
	const maxChars = maxTokens * 4;
	if (text.length <= maxChars) return text;
	return text.slice(0, maxChars) + "\n[...truncated]";
}

/** Read a file if it exists, return empty string otherwise */
function safeRead(path: string): string {
	try {
		if (!existsSync(path)) return "";
		return readFileSync(path, "utf-8").trim();
	} catch {
		return "";
	}
}

/** Find the MEMORY.md file — checks .gitagent/memory/ and memory/ */
function findMemory(agentDir: string): string {
	const candidates = [
		join(agentDir, ".gitagent", "memory", "MEMORY.md"),
		join(agentDir, "memory", "MEMORY.md"),
	];
	for (const p of candidates) {
		const content = safeRead(p);
		if (content) return content;
	}
	return "";
}

/** Read the chat summary file for a branch */
function readSummary(agentDir: string, branch: string): string {
	const safeBranch = branch.replace(/\//g, "__");
	const path = join(agentDir, ".gitagent", `chat-summary-${safeBranch}.md`);
	return safeRead(path);
}

/** Load recent chat history as a readable transcript */
function loadRecentChat(agentDir: string, branch: string, maxMessages: number = 30): string {
	const messages = loadHistory(agentDir, branch);
	if (messages.length === 0) return "";

	// Take last N messages, only transcripts and agent results
	const recent = messages.slice(-maxMessages);
	const lines: string[] = [];
	for (const msg of recent) {
		if (msg.type === "transcript") {
			lines.push(`${msg.role}: ${msg.text}`);
		} else if (msg.type === "agent_done") {
			const short = msg.result.length > 200 ? msg.result.slice(0, 200) + "..." : msg.result;
			lines.push(`agent: ${short}`);
		} else if (msg.type === "tool_call") {
			lines.push(`[used tool: ${msg.toolName}]`);
		}
	}
	return lines.join("\n");
}

export interface ContextSnapshot {
	memory: string;
	summary: string;
	recentChat: string;
}

/** Read MEMORY.md + chat-summary + recent chat, returns raw content */
export async function getContextSnapshot(agentDir: string, branch: string): Promise<ContextSnapshot> {
	return {
		memory: findMemory(agentDir),
		summary: readSummary(agentDir, branch),
		recentChat: loadRecentChat(agentDir, branch),
	};
}

/**
 * Returns context string for voice LLM system instructions.
 * Includes: memory + conversation summary + recent chat history.
 * Recent chat is critical — it survives page refreshes so the voice LLM
 * knows what just happened even when the WebSocket reconnects.
 */
export async function getVoiceContext(agentDir: string, branch: string): Promise<string> {
	const { memory, summary, recentChat } = await getContextSnapshot(agentDir, branch);
	const parts: string[] = [];

	if (memory) {
		parts.push(`[What you know about the user]\n${truncateToTokens(memory, 300)}`);
	}
	if (summary) {
		parts.push(`[Previous session summary]\n${truncateToTokens(summary, 150)}`);
	}
	if (recentChat) {
		parts.push(`[Recent conversation — this is what just happened, you were part of this]\n${truncateToTokens(recentChat, 400)}`);
	}

	if (parts.length === 0) return "";

	const context = parts.join("\n\n");
	const tokens = estimateTokens(context);
	console.error(`[voice] Injected context: ${tokens} tokens (memory: ${memory ? "yes" : "no"}, summary: ${summary ? "yes" : "no"}, chat: ${recentChat ? "yes" : "no"})`);
	return context;
}

/**
 * Returns richer context for run_agent systemPromptSuffix.
 * Includes: full memory + summary. Capped at ~2000 tokens.
 */
export async function getAgentContext(agentDir: string, branch: string): Promise<string> {
	const { memory, summary, recentChat } = await getContextSnapshot(agentDir, branch);
	const parts: string[] = [];

	if (memory) {
		parts.push(`[User Memory]\n${truncateToTokens(memory, 1200)}`);
	}
	if (summary) {
		parts.push(`[Session Summary]\n${truncateToTokens(summary, 300)}`);
	}
	if (recentChat) {
		parts.push(`[Recent Conversation]\n${truncateToTokens(recentChat, 400)}`);
	}

	if (parts.length === 0) return "";
	return parts.join("\n\n");
}

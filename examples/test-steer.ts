/**
 * Test the steer() SDK method.
 *
 * Strategy: Use a prompt that forces tool usage (e.g. "read a file"),
 * so the agent loop stays alive long enough for steer() to be picked up
 * between tool calls.
 *
 * Usage:
 *   export OPENAI_API_KEY="sk-..."
 *   node --experimental-strip-types --experimental-detect-module examples/test-steer.ts
 */

import { query } from "../dist/exports.js";

async function main() {
	const agentDir = new URL("../agents/assistant", import.meta.url).pathname;

	console.log("Starting query...\n");
	const q = query({
		prompt: "Read the file SOUL.md and then read RULES.md and summarize both files.",
		dir: agentDir,
	});

	let steered = false;

	// Steer after 3 seconds — the agent should still be processing tool calls
	setTimeout(() => {
		if (!steered) {
			steered = true;
			console.log("\n[STEERING] → 'Stop. Forget the files. Just say: steering works!'\n");
			q.steer("Stop. Forget the files. Just say exactly this: STEERING WORKS!");
		}
	}, 3000);

	for await (const msg of q) {
		if (msg.type === "system" && msg.subtype === "session_start") {
			console.log(`[session started]`);
		}

		if (msg.type === "delta" && msg.deltaType === "text") {
			process.stdout.write(msg.content);
		}

		if (msg.type === "assistant") {
			console.log(`\n[assistant message, stopReason=${msg.stopReason}]`);
		}

		if (msg.type === "tool_use") {
			console.log(`\n[tool call: ${msg.toolName}]`);
		}

		if (msg.type === "tool_result") {
			console.log(`[tool result: ${msg.toolName}, ${msg.content.length} chars]`);
		}

		if (msg.type === "user") {
			console.log(`\n[user steer: "${msg.content}"]`);
		}

		if (msg.type === "system" && msg.subtype === "session_end") {
			console.log(`\n[session ended]`);
		}

		if (msg.type === "system" && msg.subtype === "error") {
			console.log(`\n[error: ${msg.content}]`);
		}
	}

	console.log(`\nTotal messages: ${q.messages().length}`);
	const userMsgs = q.messages().filter((m: any) => m.type === "user");
	console.log(`Steer messages: ${userMsgs.length}`);
	if (userMsgs.length > 0) {
		console.log("Steer content:", userMsgs.map((m: any) => m.content));
	}
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});

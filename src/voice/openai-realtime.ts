import WebSocket from "ws";
import type { VoiceAdapter, VoiceAdapterConfig } from "./adapter.js";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

export class OpenAIRealtimeAdapter implements VoiceAdapter {
	private ws: WebSocket | null = null;
	private config: VoiceAdapterConfig;

	constructor(config: VoiceAdapterConfig) {
		this.config = config;
	}

	async connect(toolHandler: (query: string) => Promise<string>): Promise<void> {
		const model = this.config.model || "gpt-4o-realtime-preview";
		const url = `wss://api.openai.com/v1/realtime?model=${model}`;

		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(url, {
				headers: {
					Authorization: `Bearer ${this.config.apiKey}`,
					"OpenAI-Beta": "realtime=v1",
				},
			});

			this.ws.on("open", () => {
				this.sendSessionUpdate();
				resolve();
			});

			this.ws.on("error", (err) => {
				if (!this.ws) {
					reject(err);
				} else {
					console.error(dim(`[voice] WebSocket error: ${err.message}`));
				}
			});

			this.ws.on("close", () => {
				console.log(dim("[voice] WebSocket closed"));
			});

			this.ws.on("message", (data) => {
				const event = JSON.parse(data.toString());
				this.handleEvent(event, toolHandler);
			});
		});
	}

	async disconnect(): Promise<void> {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private sendSessionUpdate(): void {
		if (!this.ws) return;

		const instructions = this.config.instructions ||
			"You are a voice assistant for a git-based AI agent called gitclaw. " +
			"When the user asks you to do something with code, files, or their project, " +
			"use the run_agent tool to execute the request. Speak concisely.";

		this.send({
			type: "session.update",
			session: {
				instructions,
				voice: this.config.voice || "alloy",
				turn_detection: { type: "server_vad" },
				input_audio_transcription: { model: "whisper-1" },
				tools: [
					{
						type: "function",
						name: "run_agent",
						description: "Run a gitclaw agent query to perform tasks like reading files, writing code, running commands, etc.",
						parameters: {
							type: "object",
							properties: {
								query: {
									type: "string",
									description: "The user's request to pass to the gitclaw agent",
								},
							},
							required: ["query"],
						},
					},
				],
			},
		});
	}

	private handleEvent(event: any, toolHandler: (query: string) => Promise<string>): void {
		switch (event.type) {
			case "session.created":
				console.log(dim("[voice] Session created"));
				break;

			case "session.updated":
				console.log(dim("[voice] Session configured"));
				break;

			case "conversation.item.input_audio_transcription.completed":
				console.log(dim(`[voice] User: ${event.transcript}`));
				break;

			case "response.function_call_arguments.done":
				this.handleFunctionCall(event, toolHandler);
				break;

			case "error":
				console.error(dim(`[voice] Error: ${JSON.stringify(event.error)}`));
				break;
		}
	}

	private async handleFunctionCall(
		event: any,
		toolHandler: (query: string) => Promise<string>,
	): Promise<void> {
		const callId = event.call_id;
		const name = event.name;

		if (name !== "run_agent") {
			console.error(dim(`[voice] Unknown function call: ${name}`));
			return;
		}

		let args: { query: string };
		try {
			args = JSON.parse(event.arguments);
		} catch {
			console.error(dim("[voice] Failed to parse function arguments"));
			return;
		}

		console.log(dim(`[voice] Agent query: ${args.query}`));

		try {
			const result = await toolHandler(args.query);
			console.log(dim(`[voice] Agent response: ${result.slice(0, 200)}${result.length > 200 ? "..." : ""}`));

			// Send function output back
			this.send({
				type: "conversation.item.create",
				item: {
					type: "function_call_output",
					call_id: callId,
					output: result,
				},
			});

			// Trigger a new response so the model speaks the result
			this.send({ type: "response.create" });
		} catch (err: any) {
			console.error(dim(`[voice] Agent error: ${err.message}`));
			this.send({
				type: "conversation.item.create",
				item: {
					type: "function_call_output",
					call_id: callId,
					output: `Error: ${err.message}`,
				},
			});
			this.send({ type: "response.create" });
		}
	}

	private send(event: any): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(event));
		}
	}
}

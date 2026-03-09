import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket as WS } from "ws";
import { query } from "../sdk.js";
import type { VoiceServerOptions, ClientMessage, ServerMessage, MultimodalAdapter } from "./adapter.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { OpenAIRealtimeAdapter } from "./openai-realtime.js";
import { GeminiLiveAdapter } from "./gemini-live.js";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function createAdapter(opts: VoiceServerOptions): MultimodalAdapter {
	switch (opts.adapter) {
		case "openai-realtime":
			return new OpenAIRealtimeAdapter(opts.adapterConfig);
		case "gemini-live":
			return new GeminiLiveAdapter(opts.adapterConfig);
		default:
			throw new Error(`Unknown adapter: ${opts.adapter}`);
	}
}

function loadUIHtml(): string {
	// Try dist/voice/ui.html first (built), then src/voice/ui.html (dev)
	const thisDir = dirname(fileURLToPath(import.meta.url));
	const candidates = [
		join(thisDir, "ui.html"),
		join(thisDir, "..", "..", "src", "voice", "ui.html"),
	];
	for (const path of candidates) {
		try {
			return readFileSync(path, "utf-8");
		} catch {
			// try next
		}
	}
	return "<html><body><h1>UI not found</h1><p>Run: npm run build</p></body></html>";
}

export async function startVoiceServer(opts: VoiceServerOptions): Promise<() => Promise<void>> {
	const port = opts.port || 3333;
	const uiHtml = loadUIHtml();

	// Tool handler: runs gitclaw query and collects response text
	const toolHandler = async (prompt: string): Promise<string> => {
		const result = query({
			prompt,
			dir: opts.agentDir,
			model: opts.model,
			env: opts.env,
		});

		let text = "";
		const toolResults: string[] = [];
		const errors: string[] = [];

		for await (const msg of result) {
			if (msg.type === "assistant" && msg.content) {
				text += msg.content;
			} else if (msg.type === "tool_result" && msg.content) {
				toolResults.push(msg.content);
				console.log(dim(`[voice] Tool ${msg.toolName}: ${msg.content.slice(0, 100)}${msg.content.length > 100 ? "..." : ""}`));
			} else if (msg.type === "system" && msg.subtype === "error") {
				errors.push(msg.content);
				console.error(dim(`[voice] Agent error: ${msg.content}`));
			} else if (msg.type === "delta") {
				// Skip deltas, we get the full text from assistant message
			}
		}

		if (text) return text;
		if (errors.length > 0) return `Error: ${errors.join("; ")}`;
		if (toolResults.length > 0) return toolResults.join("\n");
		return "(no response)";
	};

	// HTTP server
	const httpServer: Server = createServer((req, res) => {
		res.setHeader("Access-Control-Allow-Origin", "*");
		res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");

		if (req.method === "OPTIONS") {
			res.writeHead(204);
			return res.end();
		}

		if (req.url === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok" }));
		} else if (req.url === "/" || req.url === "/test") {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(uiHtml);
		} else {
			res.writeHead(404);
			res.end();
		}
	});

	// WebSocket server — adapter-agnostic proxy
	const wss = new WebSocketServer({ server: httpServer });

	wss.on("connection", async (browserWs: WS) => {
		console.log(dim("[voice] Browser connected"));

		const adapter = createAdapter(opts);

		try {
			await adapter.connect({
				toolHandler,
				onMessage: (msg: ServerMessage) => {
					safeSend(browserWs, JSON.stringify(msg));
				},
			});
			console.log(dim(`[voice] Adapter ready (${opts.adapter})`));
		} catch (err: any) {
			console.error(dim(`[voice] Adapter connection failed: ${err.message}`));
			safeSend(browserWs, JSON.stringify({ type: "error", message: `Adapter failed: ${err.message}` }));
			browserWs.close();
			return;
		}

		// Parse browser messages into ClientMessage and forward to adapter
		browserWs.on("message", (data) => {
			try {
				const msg = JSON.parse(data.toString()) as ClientMessage;
				adapter.send(msg);
			} catch {
				// Ignore unparseable messages
			}
		});

		browserWs.on("close", () => {
			console.log(dim("[voice] Browser disconnected"));
			adapter.disconnect().catch(() => {});
		});
	});

	await new Promise<void>((resolve) => {
		httpServer.listen(port, () => resolve());
	});

	console.log(bold(`Voice server running on :${port}`));
	console.log(dim(`[voice] Backend: ${opts.adapter}`));
	console.log(dim(`[voice] Open http://localhost:${port} in your browser`));

	return async () => {
		// Force-close all open WebSocket connections so the HTTP server can shut down
		for (const client of wss.clients) {
			client.terminate();
		}
		wss.close();
		await new Promise<void>((resolve) => {
			httpServer.close(() => resolve());
		});
		console.log(dim("[voice] Server stopped"));
	};
}

function safeSend(ws: WS, data: string) {
	if (ws.readyState === WS.OPEN) {
		ws.send(data);
	}
}

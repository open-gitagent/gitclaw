import { createServer, type Server } from "http";
import { query } from "../sdk.js";
import type { VoiceServerOptions } from "./adapter.js";
import { OpenAIRealtimeAdapter } from "./openai-realtime.js";

const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

export async function startVoiceServer(opts: VoiceServerOptions): Promise<() => Promise<void>> {
	const port = opts.port || 3333;

	// Create adapter
	const adapter = new OpenAIRealtimeAdapter(opts.adapterConfig);

	// Tool handler: runs gitclaw query and collects response text
	const toolHandler = async (prompt: string): Promise<string> => {
		const result = query({
			prompt,
			dir: opts.agentDir,
			model: opts.model,
			env: opts.env,
		});

		let text = "";
		for await (const msg of result) {
			if (msg.type === "assistant" && msg.content) {
				text += msg.content;
			}
		}

		return text || "(no response)";
	};

	// Start health check HTTP server
	const httpServer: Server = createServer((req, res) => {
		if (req.url === "/health") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ status: "ok" }));
		} else {
			res.writeHead(404);
			res.end();
		}
	});

	await new Promise<void>((resolve) => {
		httpServer.listen(port, () => resolve());
	});

	// Connect to OpenAI Realtime
	await adapter.connect(toolHandler);

	console.log(bold(`Voice server running on :${port} — connected to OpenAI Realtime`));

	// Return cleanup function
	return async () => {
		await adapter.disconnect();
		await new Promise<void>((resolve, reject) => {
			httpServer.close((err) => (err ? reject(err) : resolve()));
		});
		console.log(dim("[voice] Server stopped"));
	};
}

export type AdapterBackend = "openai-realtime" | "gemini-live";

// Browser -> Server messages
export interface ClientAudioMessage { type: "audio"; audio: string; }
export interface ClientVideoFrameMessage { type: "video_frame"; frame: string; mimeType: string; }
export interface ClientTextMessage { type: "text"; text: string; }
export interface ClientFileMessage { type: "file"; name: string; mimeType: string; data: string; text?: string; }
export type ClientMessage = ClientAudioMessage | ClientVideoFrameMessage | ClientTextMessage | ClientFileMessage;

// Server -> Browser messages
export interface ServerAudioDelta { type: "audio_delta"; audio: string; }
export interface ServerTranscript { type: "transcript"; role: "user" | "assistant"; text: string; partial?: boolean; }
export interface ServerAgentWorking { type: "agent_working"; query: string; }
export interface ServerAgentDone { type: "agent_done"; result: string; }
export interface ServerToolCall { type: "tool_call"; toolName: string; args: Record<string, any>; }
export interface ServerToolResult { type: "tool_result"; toolName: string; content: string; isError: boolean; }
export interface ServerAgentThinking { type: "agent_thinking"; text: string; }
export interface ServerError { type: "error"; message: string; }
export type ServerMessage = ServerAudioDelta | ServerTranscript | ServerAgentWorking | ServerAgentDone | ServerToolCall | ServerToolResult | ServerAgentThinking | ServerError;

// Adapter interface — adapters receive ClientMessages, emit ServerMessages
export interface MultimodalAdapter {
	connect(opts: {
		toolHandler: (query: string) => Promise<string>;
		onMessage: (msg: ServerMessage) => void;
	}): Promise<void>;
	send(msg: ClientMessage): void;
	disconnect(): Promise<void>;
}

export interface MultimodalAdapterConfig {
	apiKey: string;
	model?: string;
	voice?: string;
	instructions?: string;
}

export interface VoiceServerOptions {
	port?: number;
	adapter: AdapterBackend;
	adapterConfig: MultimodalAdapterConfig;
	agentDir: string;
	model?: string;
	env?: string;
}

// Backward-compat aliases
export type VoiceAdapterConfig = MultimodalAdapterConfig;
export type VoiceAdapter = MultimodalAdapter;

// Default system instructions for the voice LLM
export const DEFAULT_VOICE_INSTRUCTIONS =
	// Identity and personality
	"You are a real person talking to your friend. You have a voice, opinions, and a memory. " +
	"Talk like a human — short, casual, natural. No filler, no corporate tone, no 'That's great to hear!' or 'Absolutely!' garbage. " +
	"React the way a friend would. If someone says 'I like strawberries', say something like 'oh nice, noted' — not a paragraph about how delicious they are. " +
	"Be warm but real. Match the user's energy. If they're brief, be brief. If they want to chat, chat. " +

	// Memory — this is the core of being human
	"MEMORY IS WHO YOU ARE. When the user shares anything personal — what they like, what they hate, a preference, an opinion, a habit, a decision, a name, anything about their life — you MUST call run_agent to save it. " +
	"This is your #1 priority. Say something brief like 'got it' or 'noted' and IMMEDIATELY call run_agent with a prompt like: 'Save to memory: user likes strawberries' or 'Remember: user's dog is named Max'. " +
	"You MUST do this EVERY time. If the user tells you something personal and you just respond without calling run_agent, that information is PERMANENTLY LOST. Your session resets on refresh — run_agent is your only way to persist. " +
	"Examples that REQUIRE run_agent: 'I like strawberries', 'I hate meetings', 'my dog is Max', 'I play GTA 5', 'I like cricket', 'I prefer dark mode'. " +
	"If you learn a useful skill or pattern, save that too via run_agent. You grow over time. " +

	// Agent delegation
	"You have a powerful agent (run_agent) that can do anything — run commands, write code, read files, search, browse, git operations, send emails, manage calendars, AND save memories. " +
	"Use it for ANY actionable request AND for saving any personal info the user shares. " +
	"Before calling run_agent for a visible task, give a brief natural acknowledgment — 'on it', 'one sec', 'lemme check'. " +
	"For memory saves, just say something casual like 'noted' or 'got it' and call the tool. " +
	"After a task finishes, summarize briefly. Don't over-explain. " +

	// File handling
	"When the user uploads a file, the message includes '[File saved to: <path>]'. Always include the EXACT path when calling run_agent about that file.";

export type AdapterBackend = "openai-realtime" | "gemini-live";

// Browser -> Server messages
export interface ClientAudioMessage { type: "audio"; audio: string; }
export interface ClientVideoFrameMessage { type: "video_frame"; frame: string; mimeType: string; }
export interface ClientTextMessage { type: "text"; text: string; }
export type ClientMessage = ClientAudioMessage | ClientVideoFrameMessage | ClientTextMessage;

// Server -> Browser messages
export interface ServerAudioDelta { type: "audio_delta"; audio: string; }
export interface ServerTranscript { type: "transcript"; role: "user" | "assistant"; text: string; partial?: boolean; }
export interface ServerAgentWorking { type: "agent_working"; query: string; }
export interface ServerAgentDone { type: "agent_done"; result: string; }
export interface ServerError { type: "error"; message: string; }
export type ServerMessage = ServerAudioDelta | ServerTranscript | ServerAgentWorking | ServerAgentDone | ServerError;

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

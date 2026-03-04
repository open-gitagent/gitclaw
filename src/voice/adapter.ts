export interface VoiceAdapterConfig {
	apiKey: string;
	model?: string;
	voice?: string;
	instructions?: string;
}

export interface VoiceAdapter {
	connect(toolHandler: (query: string) => Promise<string>): Promise<void>;
	disconnect(): Promise<void>;
}

export interface VoiceServerOptions {
	port?: number;
	adapter: "openai-realtime";
	adapterConfig: VoiceAdapterConfig;
	agentDir: string;
	model?: string;
	env?: string;
}

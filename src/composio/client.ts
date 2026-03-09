// Composio REST API v3 client — zero dependencies, uses native fetch()

const BASE_URL = "https://backend.composio.dev/api/v3";

// ── Types ────────────────────────────────────────────────────────────

export interface ComposioToolkit {
	slug: string;
	name: string;
	description: string;
	logo: string;
	connected: boolean;
}

export interface ComposioConnection {
	id: string;
	toolkitSlug: string;
	status: string;
	createdAt: string;
}

export interface ComposioTool {
	name: string;
	description: string;
	toolkitSlug: string;
	parameters: Record<string, any>;
}

// ── Client ───────────────────────────────────────────────────────────

export class ComposioClient {
	private apiKey: string;

	constructor(apiKey: string) {
		this.apiKey = apiKey;
	}

	// List available toolkits, optionally merging connection status for a user
	async listToolkits(userId?: string): Promise<ComposioToolkit[]> {
		const toolkits = await this.request<any[]>("GET", "/tool-router/toolkits");

		let connectedSlugs = new Set<string>();
		if (userId) {
			try {
				const conns = await this.listConnections(userId);
				connectedSlugs = new Set(conns.map((c) => c.toolkitSlug));
			} catch {
				// If connections fail, just show all as disconnected
			}
		}

		return toolkits.map((tk: any) => ({
			slug: tk.slug ?? tk.appId ?? tk.key ?? "",
			name: tk.name ?? tk.slug ?? "",
			description: tk.description ?? "",
			logo: tk.logo ?? tk.meta?.logo ?? "",
			connected: connectedSlugs.has(tk.slug ?? tk.appId ?? tk.key ?? ""),
		}));
	}

	// List tools for a specific toolkit
	async listTools(toolkitSlug: string): Promise<ComposioTool[]> {
		const tools = await this.request<any[]>(
			"GET",
			`/tool-router/toolkits/${encodeURIComponent(toolkitSlug)}/tools`,
		);

		return tools.map((t: any) => ({
			name: t.name ?? t.enum ?? "",
			description: t.description ?? "",
			toolkitSlug,
			parameters: t.parameters ?? t.inputParameters ?? {},
		}));
	}

	// Start OAuth connection flow
	async initiateConnection(
		toolkit: string,
		userId: string,
		redirectUrl?: string,
	): Promise<{ connectionId: string; redirectUrl: string }> {
		const body: Record<string, any> = {
			integrationId: toolkit,
			userUuid: userId,
		};
		if (redirectUrl) body.redirectUri = redirectUrl;

		const resp = await this.request<any>("POST", "/connected_accounts", body);
		return {
			connectionId: resp.id ?? resp.connectionId ?? "",
			redirectUrl: resp.redirectUrl ?? resp.redirectUri ?? "",
		};
	}

	// List active connections for a user
	async listConnections(userId: string): Promise<ComposioConnection[]> {
		const resp = await this.request<any>(
			"GET",
			`/connected_accounts?user_ids=${encodeURIComponent(userId)}&statuses=ACTIVE`,
		);

		const items: any[] = resp.items ?? resp.connections ?? resp ?? [];
		return items.map((c: any) => ({
			id: c.id ?? "",
			toolkitSlug: c.appUniqueId ?? c.integrationId ?? c.appName ?? "",
			status: c.status ?? "ACTIVE",
			createdAt: c.createdAt ?? "",
		}));
	}

	// Delete a connection
	async deleteConnection(id: string): Promise<void> {
		await this.request("DELETE", `/connected_accounts/${encodeURIComponent(id)}`);
	}

	// Execute a tool action
	async executeTool(
		toolName: string,
		userId: string,
		params: Record<string, any>,
	): Promise<any> {
		return this.request("POST", "/tool-router/execute", {
			actionName: toolName,
			userUuid: userId,
			input: params,
		});
	}

	// ── Private ────────────────────────────────────────────────────────

	private async request<T>(method: string, path: string, body?: any): Promise<T> {
		const url = `${BASE_URL}${path}`;
		const headers: Record<string, string> = {
			"x-api-key": this.apiKey,
			"Accept": "application/json",
		};
		if (body) headers["Content-Type"] = "application/json";

		const resp = await fetch(url, {
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!resp.ok) {
			const text = await resp.text().catch(() => "");
			throw new Error(`Composio API ${method} ${path} failed (${resp.status}): ${text}`);
		}

		if (resp.status === 204) return undefined as T;
		return resp.json() as Promise<T>;
	}
}

import { appendFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import type { HooksConfig } from "./hooks.js";

export interface AuditEntry {
	timestamp: string;
	session_id: string;
	event: string;
	tool?: string;
	args?: Record<string, any>;
	result?: string;
	error?: string;
	[key: string]: any;
}

export class AuditLogger {
	private logPath: string;
	private sessionId: string;
	private enabled: boolean;

	constructor(gitagentDir: string, sessionId: string, enabled: boolean) {
		this.logPath = join(gitagentDir, "audit.jsonl");
		this.sessionId = sessionId;
		this.enabled = enabled;
	}

	async log(event: string, data: Partial<AuditEntry> = {}): Promise<void> {
		if (!this.enabled) return;

		const entry: AuditEntry = {
			timestamp: new Date().toISOString(),
			session_id: this.sessionId,
			event,
			...data,
		};

		try {
			await mkdir(dirname(this.logPath), { recursive: true });
			await appendFile(this.logPath, JSON.stringify(entry) + "\n", "utf-8");
		} catch {
			// Audit logging failures are non-fatal
		}
	}

	async logToolUse(tool: string, args: Record<string, any>): Promise<void> {
		await this.log("tool_use", { tool, args });
	}

	async logToolResult(tool: string, result: string): Promise<void> {
		await this.log("tool_result", { tool, result: result.slice(0, 1000) });
	}

	async logResponse(): Promise<void> {
		await this.log("response");
	}

	async logError(error: string): Promise<void> {
		await this.log("error", { error });
	}

	async logSessionStart(): Promise<void> {
		await this.log("session_start");
	}

	async logSessionEnd(): Promise<void> {
		await this.log("session_end");
	}
}

/**
 * Check if audit logging is enabled via compliance config.
 */
export function isAuditEnabled(compliance?: Record<string, any>): boolean {
	if (!compliance) return false;
	return compliance.recordkeeping?.audit_logging === true;
}

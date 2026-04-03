// ── Per-model cost and token tracking ──────────────────────────────────

export interface ModelUsage {
	inputTokens: number;
	outputTokens: number;
	cacheReadTokens: number;
	cacheWriteTokens: number;
	totalTokens: number;
	costUsd: number;
	requests: number;
}

export interface SessionCosts {
	totalCostUsd: number;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalRequests: number;
	startTime: number;
	modelUsage: Record<string, ModelUsage>;
}

/**
 * Tracks token usage and cost per model across a session.
 * Mirrors Claude Code's cost-tracker pattern.
 */
export class CostTracker {
	private costs: SessionCosts;

	constructor() {
		this.costs = {
			totalCostUsd: 0,
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalRequests: 0,
			startTime: Date.now(),
			modelUsage: {},
		};
	}

	add(
		model: string,
		usage: {
			inputTokens: number;
			outputTokens: number;
			cacheReadTokens?: number;
			cacheWriteTokens?: number;
			totalTokens?: number;
			costUsd?: number;
		},
	): void {
		this.costs.totalInputTokens += usage.inputTokens;
		this.costs.totalOutputTokens += usage.outputTokens;
		this.costs.totalCostUsd += usage.costUsd ?? 0;
		this.costs.totalRequests++;

		if (!this.costs.modelUsage[model]) {
			this.costs.modelUsage[model] = {
				inputTokens: 0,
				outputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalTokens: 0,
				costUsd: 0,
				requests: 0,
			};
		}
		const mu = this.costs.modelUsage[model];
		mu.inputTokens += usage.inputTokens;
		mu.outputTokens += usage.outputTokens;
		mu.cacheReadTokens += usage.cacheReadTokens ?? 0;
		mu.cacheWriteTokens += usage.cacheWriteTokens ?? 0;
		mu.totalTokens += usage.totalTokens ?? (usage.inputTokens + usage.outputTokens);
		mu.costUsd += usage.costUsd ?? 0;
		mu.requests++;
	}

	get(): SessionCosts {
		return {
			...this.costs,
			modelUsage: { ...this.costs.modelUsage },
		};
	}

	reset(): void {
		this.costs = {
			totalCostUsd: 0,
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalRequests: 0,
			startTime: Date.now(),
			modelUsage: {},
		};
	}
}

import { readFile } from "fs/promises";
import { join } from "path";
import yaml from "js-yaml";
import type { AgentManifest } from "./loader.js";

export interface ComplianceConfig {
	risk_level?: "low" | "medium" | "high" | "critical";
	human_in_the_loop?: boolean;
	data_classification?: string;
	regulatory_frameworks?: string[];
	recordkeeping?: {
		audit_logging?: boolean;
		retention_days?: number;
	};
	review?: {
		required_approvers?: number;
		auto_review?: boolean;
	};
	[key: string]: any;
}

export interface ComplianceWarning {
	rule: string;
	message: string;
	severity: "error" | "warning";
}

interface RegulatoryMap {
	frameworks?: Record<string, any>;
	[key: string]: any;
}

interface ValidationSchedule {
	checks?: Array<{
		name: string;
		frequency: string;
		description?: string;
	}>;
	[key: string]: any;
}

/**
 * Validate compliance section of agent manifest against spec rules.
 */
export function validateCompliance(manifest: AgentManifest): ComplianceWarning[] {
	const warnings: ComplianceWarning[] = [];
	const compliance = manifest.compliance as ComplianceConfig | undefined;

	if (!compliance) return warnings;

	// Rule: High/critical risk agents should have human_in_the_loop
	if (
		(compliance.risk_level === "high" || compliance.risk_level === "critical") &&
		!compliance.human_in_the_loop
	) {
		warnings.push({
			rule: "high_risk_hitl",
			message: `Agent with risk_level "${compliance.risk_level}" should have human_in_the_loop enabled`,
			severity: "warning",
		});
	}

	// Rule: Critical risk agents must have audit logging
	if (compliance.risk_level === "critical" && !compliance.recordkeeping?.audit_logging) {
		warnings.push({
			rule: "critical_audit",
			message: "Critical risk agents must have recordkeeping.audit_logging enabled",
			severity: "error",
		});
	}

	// Rule: If regulatory frameworks specified, recordkeeping should exist
	if (
		compliance.regulatory_frameworks &&
		compliance.regulatory_frameworks.length > 0 &&
		!compliance.recordkeeping
	) {
		warnings.push({
			rule: "regulatory_recordkeeping",
			message: "Agents with regulatory frameworks should have recordkeeping configured",
			severity: "warning",
		});
	}

	// Rule: Review required for high/critical risk
	if (
		(compliance.risk_level === "high" || compliance.risk_level === "critical") &&
		!compliance.review
	) {
		warnings.push({
			rule: "high_risk_review",
			message: `Agent with risk_level "${compliance.risk_level}" should have review configuration`,
			severity: "warning",
		});
	}

	// Rule: Audit logging requires retention policy
	if (compliance.recordkeeping?.audit_logging && !compliance.recordkeeping?.retention_days) {
		warnings.push({
			rule: "audit_retention",
			message: "Audit logging enabled but no retention_days specified",
			severity: "warning",
		});
	}

	// Rule: Data classification should be specified for regulated agents
	if (compliance.regulatory_frameworks && !compliance.data_classification) {
		warnings.push({
			rule: "data_classification",
			message: "Regulated agents should specify data_classification",
			severity: "warning",
		});
	}

	return warnings;
}

/**
 * Load compliance directory files and format summary for system prompt.
 */
export async function loadComplianceContext(agentDir: string): Promise<string> {
	const complianceDir = join(agentDir, "compliance");
	const parts: string[] = [];

	// Load regulatory map
	try {
		const raw = await readFile(join(complianceDir, "regulatory-map.yaml"), "utf-8");
		const map = yaml.load(raw) as RegulatoryMap;
		if (map?.frameworks) {
			const frameworks = Object.keys(map.frameworks).join(", ");
			parts.push(`Regulatory frameworks: ${frameworks}`);
		}
	} catch {
		// No regulatory map
	}

	// Load validation schedule
	try {
		const raw = await readFile(join(complianceDir, "validation-schedule.yaml"), "utf-8");
		const schedule = yaml.load(raw) as ValidationSchedule;
		if (schedule?.checks && schedule.checks.length > 0) {
			const checkList = schedule.checks
				.map((c) => `- ${c.name} (${c.frequency})${c.description ? `: ${c.description}` : ""}`)
				.join("\n");
			parts.push(`Validation schedule:\n${checkList}`);
		}
	} catch {
		// No validation schedule
	}

	if (parts.length === 0) return "";
	return `# Compliance\n\n${parts.join("\n\n")}`;
}

export function formatComplianceWarnings(warnings: ComplianceWarning[]): string {
	if (warnings.length === 0) return "";
	return warnings
		.map((w) => `  ${w.severity === "error" ? "✗" : "⚠"} [${w.rule}] ${w.message}`)
		.join("\n");
}

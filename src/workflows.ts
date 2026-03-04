import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import yaml from "js-yaml";

export interface WorkflowMetadata {
	name: string;
	description: string;
	filePath: string;
	format: "yaml" | "markdown";
}

function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, body: content };
	}
	const frontmatter = yaml.load(match[1]) as Record<string, any>;
	return { frontmatter, body: match[2] };
}

export async function discoverWorkflows(agentDir: string): Promise<WorkflowMetadata[]> {
	const workflowsDir = join(agentDir, "workflows");

	try {
		const s = await stat(workflowsDir);
		if (!s.isDirectory()) return [];
	} catch {
		return [];
	}

	const entries = await readdir(workflowsDir);
	const workflows: WorkflowMetadata[] = [];

	for (const entry of entries) {
		const filePath = join(workflowsDir, entry);
		const s = await stat(filePath);
		if (!s.isFile()) continue;

		if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
			try {
				const raw = await readFile(filePath, "utf-8");
				const data = yaml.load(raw) as Record<string, any>;
				if (data?.name && data?.description) {
					workflows.push({
						name: data.name,
						description: data.description,
						filePath: `workflows/${entry}`,
						format: "yaml",
					});
				}
			} catch {
				// Skip invalid YAML
			}
		} else if (entry.endsWith(".md")) {
			try {
				const raw = await readFile(filePath, "utf-8");
				const { frontmatter } = parseFrontmatter(raw);
				const name = (frontmatter.name as string) || entry.replace(/\.md$/, "");
				const description = (frontmatter.description as string) || "";
				if (description) {
					workflows.push({
						name,
						description,
						filePath: `workflows/${entry}`,
						format: "markdown",
					});
				}
			} catch {
				// Skip unreadable files
			}
		}
	}

	return workflows.sort((a, b) => a.name.localeCompare(b.name));
}

export function formatWorkflowsForPrompt(workflows: WorkflowMetadata[]): string {
	if (workflows.length === 0) return "";

	const entries = workflows
		.map(
			(w) =>
				`<workflow>\n<name>${w.name}</name>\n<description>${w.description}</description>\n<path>${w.filePath}</path>\n</workflow>`,
		)
		.join("\n");

	return `# Workflows

<available_workflows>
${entries}
</available_workflows>

Use the \`read\` tool to load a workflow's full definition when you need to follow it.`;
}

import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";

export interface ExampleEntry {
	name: string;
	content: string;
}

export async function loadExamples(agentDir: string): Promise<ExampleEntry[]> {
	const examplesDir = join(agentDir, "examples");

	try {
		const s = await stat(examplesDir);
		if (!s.isDirectory()) return [];
	} catch {
		return [];
	}

	const entries = await readdir(examplesDir);
	const examples: ExampleEntry[] = [];

	for (const entry of entries) {
		if (!entry.endsWith(".md")) continue;

		try {
			const content = await readFile(join(examplesDir, entry), "utf-8");
			const name = entry.replace(/\.md$/, "");
			examples.push({ name, content: content.trim() });
		} catch {
			// Skip unreadable files
		}
	}

	return examples.sort((a, b) => a.name.localeCompare(b.name));
}

export function formatExamplesForPrompt(examples: ExampleEntry[]): string {
	if (examples.length === 0) return "";

	const blocks = examples
		.map((e) => `<example name="${e.name}">\n${e.content}\n</example>`)
		.join("\n\n");

	return `# Examples

<examples>
${blocks}
</examples>`;
}

import { defineConfig } from "vitest/config"

// Unit tests for the extension host (`src/`). The webview UI keeps its own
// vitest setup under `webview-ui/`.
export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.{test,spec}.ts"],
	},
})

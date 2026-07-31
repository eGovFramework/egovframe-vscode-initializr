/// <reference types="vitest/config" />

import { defineConfig, ViteDevServer, type Plugin } from "vite"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react-swc"
import { resolve } from "path"
import { writeFileSync } from "node:fs"

// Custom plugin to write the server port to a file
const writePortToFile = (): Plugin => {
	return {
		name: "write-port-to-file",
		configureServer(server: ViteDevServer) {
			server.httpServer?.once("listening", () => {
				const address = server.httpServer?.address()
				const port = typeof address === "object" && address ? address.port : null

				if (port) {
					const portFilePath = resolve(__dirname, ".vite-port")
					writeFileSync(portFilePath, port.toString())
				} else {
					console.warn("[writePortToFile] Could not determine server port")
				}
			})
		},
	}
}

export default defineConfig({
	plugins: [react(), tailwindcss(), writePortToFile()],
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/setupTests.ts"],
		// monaco-editor 0.31은 package.json에 main 필드가 없어 테스트 환경에서 해석되지 않는다.
		// 에디터는 테스트 대상이 아니므로 테스트에서만 빈 스텁으로 대체한다.
		alias: [{ find: /^monaco-editor$/, replacement: resolve(__dirname, "./src/__mocks__/monaco-editor.ts") }],
		coverage: {
			provider: "v8",
			reportOnFailure: true,
		},
	},
	build: {
		outDir: "build",
		reportCompressedSize: false,
		rollupOptions: {
			output: {
				inlineDynamicImports: true,
				entryFileNames: `assets/[name].js`,
				chunkFileNames: `assets/[name].js`,
				assetFileNames: (assetInfo) => {
					if (
						assetInfo.name &&
						(assetInfo.name.endsWith(".woff2") || assetInfo.name.endsWith(".woff") || assetInfo.name.endsWith(".ttf"))
					) {
						return "assets/fonts/[name][extname]"
					}
					return "assets/[name][extname]"
				},
			},
		},
		chunkSizeWarningLimit: 100000,
	},
	server: {
		port: 25463,
		hmr: {
			host: "localhost",
			protocol: "ws",
		},
		cors: {
			origin: "*",
			methods: "*",
			allowedHeaders: "*",
		},
	},
	define: {
		"process.env": {
			NODE_ENV: JSON.stringify(process.env.IS_DEV ? "development" : "production"),
			IS_DEV: JSON.stringify(process.env.IS_DEV),
			IS_TEST: JSON.stringify(process.env.IS_TEST),
		},
	},
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@components": resolve(__dirname, "./src/components"),
			"@context": resolve(__dirname, "./src/context"),
			"@shared": resolve(__dirname, "../src/shared"),
			"@utils": resolve(__dirname, "./src/utils"),
		},
	},
})

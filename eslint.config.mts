import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";

const recommendedConfigs = (obsidianmd.configs?.recommended ?? []) as unknown as Iterable<object>;

export default defineConfig([
	...recommendedConfigs,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsParser,
			globals: {
				...globals.browser,
			},
			parserOptions: {
				project: "./tsconfig.json",
				extraFileExtensions: [".json"],
			},
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"build",
		"coverage",
		"*.min.js",
		"esbuild.config.mjs",
		"eslint.config.js",
		"eslint.config.mts",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
]);

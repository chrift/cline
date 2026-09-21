// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
	MODEL_SELECTION_STORAGE_KEY,
	parseModelSelectionStorage,
	readModelSelectionStorageFromWindow,
	rememberLastReasoning,
	writeModelSelectionStorageToWindow,
} from "./model-selection";

describe("parseModelSelectionStorage", () => {
	it("accepts the legacy payload with no reasoning preference stored", () => {
		expect(
			parseModelSelectionStorage(
				JSON.stringify({
					lastProvider: "cline-pass",
					lastModelByProvider: { "cline-pass": "cline-pass/kimi-k3" },
				}),
			),
		).toEqual({
			lastProvider: "cline-pass",
			lastModelByProvider: { "cline-pass": "cline-pass/kimi-k3" },
		});
	});

	it("drops an unusable reasoning preference instead of trusting it", () => {
		expect(
			parseModelSelectionStorage(
				JSON.stringify({ lastProvider: "cline", lastReasoning: "medium" }),
			),
		).toEqual({ lastProvider: "cline", lastModelByProvider: {} });
	});
});

describe("rememberLastReasoning", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("keeps the remembered model when only the level changes", () => {
		writeModelSelectionStorageToWindow({
			lastProvider: "cline",
			lastModelByProvider: { cline: "test-model" },
		});

		rememberLastReasoning({ thinking: true, reasoningEffort: "high" });

		expect(readModelSelectionStorageFromWindow()).toEqual({
			lastProvider: "cline",
			lastModelByProvider: { cline: "test-model" },
			lastReasoning: { thinking: true, reasoningEffort: "high" },
		});
	});

	it("keeps the remembered level when only the model changes", () => {
		rememberLastReasoning({ thinking: false, reasoningEffort: undefined });

		// This is the model picker's own write path.
		writeModelSelectionStorageToWindow({
			lastProvider: "anthropic",
			lastModelByProvider: { anthropic: "claude-sonnet-4-6" },
		});

		expect(readModelSelectionStorageFromWindow()).toEqual({
			lastProvider: "anthropic",
			lastModelByProvider: { anthropic: "claude-sonnet-4-6" },
			lastReasoning: { thinking: false, reasoningEffort: undefined },
		});
		const stored = JSON.parse(
			String(window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY)),
		);
		expect(stored.lastReasoning.thinking).toBe(false);
	});
});

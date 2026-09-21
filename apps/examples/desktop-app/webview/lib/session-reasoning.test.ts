// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
	MAX_REMEMBERED_REASONING_SESSIONS,
	parseSessionReasoningChoice,
	parseSessionReasoningStore,
	readRememberedReasoning,
	rememberReasoningForSession,
	SESSION_REASONING_STORAGE_KEY,
} from "./session-reasoning";

describe("parseSessionReasoningChoice", () => {
	it("keeps an explicit None without the level left beside it", () => {
		expect(
			parseSessionReasoningChoice({ thinking: false, reasoningEffort: "high" }),
		).toEqual({ thinking: false, reasoningEffort: undefined });
	});

	it("treats a level as reasoning enabled", () => {
		expect(parseSessionReasoningChoice({ reasoningEffort: "medium" })).toEqual({
			thinking: true,
			reasoningEffort: "medium",
		});
	});

	it("drops an unknown level instead of trusting it", () => {
		expect(
			parseSessionReasoningChoice({ thinking: true, reasoningEffort: "ultra" }),
		).toEqual({ thinking: true, reasoningEffort: undefined });
		expect(parseSessionReasoningChoice({})).toBeUndefined();
		expect(parseSessionReasoningChoice("medium")).toBeUndefined();
		expect(parseSessionReasoningChoice(null)).toBeUndefined();
	});
});

describe("session reasoning store", () => {
	beforeEach(() => {
		window.localStorage.clear();
	});

	it("round-trips a remembered choice", () => {
		rememberReasoningForSession("session_a", {
			thinking: true,
			reasoningEffort: "low",
		});
		expect(readRememberedReasoning("session_a")).toEqual({
			thinking: true,
			reasoningEffort: "low",
		});
		expect(readRememberedReasoning("session_b")).toBeUndefined();
	});

	it("replaces a choice rather than merging into it", () => {
		rememberReasoningForSession("session_a", {
			thinking: true,
			reasoningEffort: "high",
		});
		rememberReasoningForSession("session_a", { thinking: false });
		expect(readRememberedReasoning("session_a")).toEqual({
			thinking: false,
			reasoningEffort: undefined,
		});
	});

	it("forgets when the level is unknown, instead of storing a blank entry", () => {
		rememberReasoningForSession("session_a", {
			thinking: true,
			reasoningEffort: "low",
		});
		rememberReasoningForSession("session_a", {
			thinking: undefined,
			reasoningEffort: undefined,
		});
		expect(window.localStorage.getItem(SESSION_REASONING_STORAGE_KEY)).toBe(
			"{}",
		);
		expect(readRememberedReasoning("session_a")).toBeUndefined();
	});

	it("caps the store at the most recent chats", () => {
		const total = MAX_REMEMBERED_REASONING_SESSIONS + 25;
		for (let index = 0; index < total; index += 1) {
			rememberReasoningForSession(`session_${index}`, {
				thinking: true,
				reasoningEffort: "low",
			});
		}
		const stored = parseSessionReasoningStore(
			window.localStorage.getItem(SESSION_REASONING_STORAGE_KEY),
		);
		expect(Object.keys(stored)).toHaveLength(MAX_REMEMBERED_REASONING_SESSIONS);
		expect(stored[`session_${total - 1}`]).toBeDefined();
		expect(stored.session_0).toBeUndefined();
	});

	it("ignores malformed stored JSON", () => {
		window.localStorage.setItem(SESSION_REASONING_STORAGE_KEY, "{oops");
		expect(readRememberedReasoning("session_a")).toBeUndefined();
		window.localStorage.setItem(SESSION_REASONING_STORAGE_KEY, "[1,2]");
		expect(readRememberedReasoning("session_a")).toBeUndefined();
	});
});

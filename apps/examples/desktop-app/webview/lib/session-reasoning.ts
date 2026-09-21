import type { ChatSessionConfig } from "@/lib/chat-schema";

/** The reasoning fields a chat can be configured with. */
export type SessionReasoningChoice = Pick<
	ChatSessionConfig,
	"thinking" | "reasoningEffort"
>;

export type ReasoningEffortChoice = NonNullable<
	ChatSessionConfig["reasoningEffort"]
>;

export const SESSION_REASONING_STORAGE_KEY = "cline.code.session-reasoning.v1";

/**
 * Bounds the store: one entry per chat the user has touched on this device.
 * Insertion order is the recency order, so the oldest entries are dropped.
 */
export const MAX_REMEMBERED_REASONING_SESSIONS = 200;

function isReasoningEffort(value: unknown): value is ReasoningEffortChoice {
	return (
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	);
}

/**
 * Normalizes one stored entry. `thinking: false` is the explicit "None" choice
 * and never carries an effort level, so a half-written entry cannot make a chat
 * look reasoned when it is not. Returns undefined when nothing is knowable.
 */
export function parseSessionReasoningChoice(
	value: unknown,
): SessionReasoningChoice | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return undefined;
	}
	const shaped = value as { thinking?: unknown; reasoningEffort?: unknown };
	const reasoningEffort = isReasoningEffort(shaped.reasoningEffort)
		? shaped.reasoningEffort
		: undefined;
	if (shaped.thinking === false) {
		return { thinking: false, reasoningEffort: undefined };
	}
	if (shaped.thinking === true || reasoningEffort) {
		return { thinking: true, reasoningEffort };
	}
	return undefined;
}

export function parseSessionReasoningStore(
	raw: string | null,
): Record<string, SessionReasoningChoice> {
	if (!raw) {
		return {};
	}
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}
		const entries: Record<string, SessionReasoningChoice> = {};
		for (const [sessionId, value] of Object.entries(parsed)) {
			const choice = parseSessionReasoningChoice(value);
			if (sessionId.trim() && choice) {
				entries[sessionId] = choice;
			}
		}
		return entries;
	} catch {
		return {};
	}
}

function readStore(): Record<string, SessionReasoningChoice> {
	if (typeof window === "undefined") {
		return {};
	}
	return parseSessionReasoningStore(
		window.localStorage.getItem(SESSION_REASONING_STORAGE_KEY),
	);
}

function writeStore(entries: Record<string, SessionReasoningChoice>): void {
	if (typeof window === "undefined") {
		return;
	}
	window.localStorage.setItem(
		SESSION_REASONING_STORAGE_KEY,
		JSON.stringify(capStore(entries)),
	);
}

function capStore(
	entries: Record<string, SessionReasoningChoice>,
): Record<string, SessionReasoningChoice> {
	const keys = Object.keys(entries);
	if (keys.length <= MAX_REMEMBERED_REASONING_SESSIONS) {
		return entries;
	}
	return Object.fromEntries(
		keys
			.slice(keys.length - MAX_REMEMBERED_REASONING_SESSIONS)
			.map((key) => [key, entries[key] as SessionReasoningChoice]),
	);
}

/** The level chosen for this chat on this device, if it ever was. */
export function readRememberedReasoning(
	sessionId: string | undefined,
): SessionReasoningChoice | undefined {
	if (!sessionId) {
		return undefined;
	}
	return readStore()[sessionId];
}

/**
 * Records the user's own choice for a chat. Deliberately not called with a value
 * that merely came back from the host: that would let a chat's old setting
 * outrank a newer one the user picked here.
 */
export function rememberReasoningForSession(
	sessionId: string | undefined,
	choice: SessionReasoningChoice,
): void {
	if (!sessionId) {
		return;
	}
	const entries = readStore();
	// Re-insert so the newest touch is the last key (capStore keeps the tail).
	delete entries[sessionId];
	// An all-undefined choice means the chat has no known level: drop the entry
	// rather than storing something the reader would have to guess about.
	const normalized = parseSessionReasoningChoice(choice);
	if (normalized) {
		entries[sessionId] = normalized;
	}
	writeStore(entries);
}

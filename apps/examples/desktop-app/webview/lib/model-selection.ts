import {
	parseSessionReasoningChoice,
	type SessionReasoningChoice,
} from "./session-reasoning";

export const MODEL_SELECTION_STORAGE_KEY = "cline.code.model-selection.v1";

export type ModelSelectionStorage = {
	lastProvider: string;
	lastModelByProvider: Record<string, string>;
	/**
	 * The reasoning level the user last picked, so a new chat starts where they
	 * left off instead of at a built-in default. Absent until they pick once.
	 */
	lastReasoning?: SessionReasoningChoice;
};

function sanitizeStringRecord(value: unknown): Record<string, string> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return Object.fromEntries(
		Object.entries(value).filter(
			([key, entry]) =>
				typeof key === "string" &&
				typeof entry === "string" &&
				entry.trim().length > 0,
		),
	);
}

export function parseModelSelectionStorage(
	raw: string | null,
): ModelSelectionStorage {
	const empty: ModelSelectionStorage = {
		lastProvider: "",
		lastModelByProvider: {},
	};
	if (!raw) {
		return empty;
	}

	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return empty;
		}

		const shaped = parsed as {
			lastProvider?: unknown;
			lastModelByProvider?: unknown;
			lastReasoning?: unknown;
		};

		if ("lastProvider" in shaped || "lastModelByProvider" in shaped) {
			const lastReasoning = parseSessionReasoningChoice(shaped.lastReasoning);
			return {
				lastProvider:
					typeof shaped.lastProvider === "string"
						? shaped.lastProvider.trim()
						: "",
				lastModelByProvider: sanitizeStringRecord(shaped.lastModelByProvider),
				...(lastReasoning ? { lastReasoning } : {}),
			};
		}

		return {
			lastProvider: "",
			lastModelByProvider: sanitizeStringRecord(parsed),
		};
	} catch {
		return empty;
	}
}

export function readModelSelectionStorageFromWindow(): ModelSelectionStorage {
	if (typeof window === "undefined") {
		return {
			lastProvider: "",
			lastModelByProvider: {},
		};
	}
	return parseModelSelectionStorage(
		window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY),
	);
}

export function writeModelSelectionStorageToWindow(
	value: ModelSelectionStorage,
): void {
	if (typeof window === "undefined") {
		return;
	}
	// The provider/model writers never touch reasoning and the reasoning writer
	// never touches provider/model, so merge over what is already stored instead
	// of letting either side wipe the other.
	const previous = parseModelSelectionStorage(
		window.localStorage.getItem(MODEL_SELECTION_STORAGE_KEY),
	);
	window.localStorage.setItem(
		MODEL_SELECTION_STORAGE_KEY,
		JSON.stringify({
			...previous,
			...value,
			lastReasoning: value.lastReasoning ?? previous.lastReasoning,
		}),
	);
}

/** Records the level a new chat should start with. */
export function rememberLastReasoning(choice: SessionReasoningChoice): void {
	writeModelSelectionStorageToWindow({
		...readModelSelectionStorageFromWindow(),
		lastReasoning: choice,
	});
}

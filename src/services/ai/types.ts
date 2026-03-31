/** Supported AI provider identifiers. */
export type AiProviderId = "nvidia";

/** Configuration needed to connect to an AI provider. */
export interface AiProviderConfig {
    provider: AiProviderId;
    apiKey: string;
    baseUrl: string;
    model: string;
}

/** User preferences for meal plan generation. */
export interface MealPlanPreferences {
    likedFoods: string;
    dislikedFoods: string;
    days: number;
}

/** Simplified food payload sent to the AI model. */
export interface AiFoodPayload {
    id: number;
    name: string;
    calories_per_100g: number;
    protein_per_100g: number;
    carbs_per_100g: number;
    fat_per_100g: number;
    default_unit: string;
    serving_size: number;
}

/** Simplified recipe payload sent to the AI model. */
export interface AiRecipePayload {
    id: number;
    name: string;
    items: { food_id: number; quantity_grams: number }[];
}

/** Macro targets sent to the AI model. */
export interface AiGoalsPayload {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
}

/** A single meal entry in the AI-generated plan. */
export interface AiMealPlanEntry {
    date: string;
    meal_type: "breakfast" | "lunch" | "dinner" | "snack";
    food_id: number;
    quantity_grams: number;
}

/** The full meal plan returned by the AI. */
export interface AiMealPlanResponse {
    entries: AiMealPlanEntry[];
}

// ── Chat message types ────────────────────────────────────

/** A tool call embedded in an assistant message (OpenAI format). */
export interface AssistantToolCall {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
}

/** Chat message format for the API. Supports system, user, assistant (with optional tool_calls), and tool roles. */
export type ChatMessage =
    | { role: "system"; content: string }
    | { role: "user"; content: string }
    | { role: "assistant"; content: string; tool_calls?: AssistantToolCall[] }
    | { role: "tool"; content: string; tool_call_id: string };

// ── OpenAI-compatible tool definition format ──────────────

export interface OpenAiToolFunction {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, { type: string; description: string; enum?: string[] }>;
        required: string[];
    };
}

export interface OpenAiTool {
    type: "function";
    function: OpenAiToolFunction;
}

// ── AI response types ─────────────────────────────────────

/** Structured response from AI — either plain text or a tool call. */
export type AiChatResponse =
    | { type: "text"; content: string }
    | { type: "tool_call"; id: string; name: string; arguments: Record<string, unknown> };

/** Status phases during streaming generation. */
export type StreamStatus = "connecting" | "thinking" | "generating" | "refining" | "done";

/** Callbacks for streaming chat responses. */
export interface StreamCallbacks {
    onStatus: (status: StreamStatus) => void;
    onToken: (accumulated: string) => void;
}

/** Options for a chat request, optionally with tools. */
export interface ChatOptions {
    tools?: OpenAiTool[];
    signal?: AbortSignal;
}

/** Abstract AI provider interface. */
export interface AiProvider {
    readonly id: AiProviderId;
    /** Whether this provider supports streaming responses. */
    readonly supportsStreaming?: boolean;
    /** Whether this provider supports native OpenAI-style tool/function calling. */
    readonly supportsToolCalling?: boolean;
    /** Send a chat completion request and return the response. */
    chat(
        config: AiProviderConfig,
        messages: ChatMessage[],
        options?: ChatOptions,
    ): Promise<AiChatResponse>;
    /** Stream a chat completion, calling back with status updates and tokens. */
    chatStream?(
        config: AiProviderConfig,
        messages: ChatMessage[],
        callbacks: StreamCallbacks,
        options?: ChatOptions,
    ): Promise<AiChatResponse>;
}

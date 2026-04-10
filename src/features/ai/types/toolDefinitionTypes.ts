
export interface ToolParameterProperty {
    type: string;
    description: string;
    enum?: string[];
}

export interface AiToolDefinition {
    name: string;
    description: string;
    needsApproval: boolean;
    parameters: {
        type: "object";
        properties: Record<string, ToolParameterProperty>;
        required: string[];
    };
}

export interface AiToolCall {
    name: string;
    arguments: Record<string, unknown>;
}

export interface AiToolResult {
    success: boolean;
    summary: string;
    data?: unknown;
}
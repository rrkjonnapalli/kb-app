export const ModelProvider = {
    AZURE: 'AZURE',
    OPENAI: 'OPENAI',
    DEEPSEEK: 'DEEPSEEK',
    OLLAMA: 'OLLAMA',
    CUSTOM: 'CUSTOM',
} as const;

export type ModelProviderValue = (typeof ModelProvider)[keyof typeof ModelProvider];

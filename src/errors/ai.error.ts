import { AppError } from '@errors/app.error';

export class ChatNotConfiguredError extends AppError {
    constructor() {
        super(
            'CHAT_NOT_CONFIGURED',
            'Chat model is not configured. Set CHAT_MODEL_PROVIDER environment variable.',
            503,
        );
        this.name = 'ChatNotConfiguredError';
    }
}

export class EmbedNotConfiguredError extends AppError {
    constructor() {
        super(
            'EMBED_NOT_CONFIGURED',
            'Embedding model is not configured. Set EMBED_MODEL_PROVIDER environment variable.',
            503,
        );
        this.name = 'EmbedNotConfiguredError';
    }
}

export class ProviderUnsupportedError extends AppError {
    constructor(kind: 'chat' | 'embed', provider: string) {
        super(
            'PROVIDER_UNSUPPORTED',
            `Unsupported ${kind} model provider: "${provider}". Valid values: AZURE, OPENAI, DEEPSEEK, OLLAMA, CUSTOM.`,
            400,
        );
        this.name = 'ProviderUnsupportedError';
    }
}

export class AzureSourceDisabledError extends AppError {
    constructor(feature: string) {
        super(
            'AZURE_SOURCE_DISABLED',
            `${feature} is unavailable. Set AZURE_SOURCE=Y and provide Azure credentials to enable it.`,
            503,
        );
        this.name = 'AzureSourceDisabledError';
    }
}

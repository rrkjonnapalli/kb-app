import { AppError } from '@errors/app.error';

/** Required environment variable is missing */
export class EnvMissingError extends AppError {
    constructor(key: string) {
        super('ENV_MISSING', `Missing required environment variable: ${key}`);
        this.name = 'EnvMissingError';
    }
}

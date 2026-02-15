import { AppError } from '@errors/app.error';

/** Parser method not supported — use the async function instead */
export class ParserNotSupportedError extends AppError {
    constructor(parser: string, alternative: string) {
        super('PARSER_NOT_SUPPORTED', `${parser}: use ${alternative} instead`, 500);
        this.name = 'ParserNotSupportedError';
    }
}

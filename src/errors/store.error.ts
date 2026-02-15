import { AppError } from '@errors/app.error';

/** Store not connected — connect() must be called before accessing stores */
export class StoreNotConnectedError extends AppError {
    constructor(store_type: string) {
        super('STORE_NOT_CONNECTED', `${store_type}: connect() must be called before accessing stores`);
        this.name = 'StoreNotConnectedError';
    }
}

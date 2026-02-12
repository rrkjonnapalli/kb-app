import { MongoClient, type Db, type Collection, type Document } from 'mongodb';
import { env } from '@config/env';
import { logger } from '@utils/log.util';

let client: MongoClient | null = null;
let db: Db | null = null;

/**
 * Get or create the MongoClient singleton and connect.
 * Reuses the existing connection if already established.
 * @returns The connected MongoClient instance
 */
async function getClient(): Promise<MongoClient> {
    if (!client) {
        client = new MongoClient(env.MONGODB_URI);
        await client.connect();
        logger.info('Connected to MongoDB');
    }
    return client;
}

/**
 * Get the database instance. Connects if not already connected.
 * @returns The MongoDB database instance
 */
export async function getDb(): Promise<Db> {
    if (!db) {
        const c = await getClient();
        db = c.db(env.MONGODB_DB_NAME);
    }
    return db;
}

/**
 * Get a typed collection by name. Connects if not already connected.
 * @param name - The collection name
 * @returns A typed MongoDB Collection
 */
export async function getCollection<T extends Document = Document>(
    name: string,
): Promise<Collection<T>> {
    const database = await getDb();
    return database.collection<T>(name);
}

/**
 * Close the MongoDB connection gracefully.
 * Safe to call multiple times.
 */
export async function closeMongo(): Promise<void> {
    if (client) {
        await client.close();
        client = null;
        db = null;
        logger.info('MongoDB connection closed');
    }
}

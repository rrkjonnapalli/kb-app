import type { Collection, Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import type { MetaStore } from '@store/store.interface';

/**
 * MongoDB implementation of MetaStore — generic CRUD on a Mongo collection.
 * Used for files, sync_state, and any other non-vector entity.
 */
export class MongoMetaStore<T extends Record<string, unknown>> implements MetaStore<T> {
    private readonly collection: Collection<Document>;

    constructor(collection: Collection<Document>) {
        this.collection = collection;
    }

    /** Insert a record, return its ID as string */
    async insert(record: Partial<T>): Promise<string> {
        const result = await this.collection.insertOne(record as Document);
        return result.insertedId.toString();
    }

    /** Find a record by its _id */
    async find_by_id(id: string): Promise<T | null> {
        const doc = await this.collection.findOne({ _id: new ObjectId(id) as unknown as Document['_id'] });
        if (!doc) return null;
        return { ...doc, _id: doc._id.toString() } as unknown as T;
    }

    /** Find a single record matching partial filter */
    async find_one(filter: Partial<T>): Promise<T | null> {
        const doc = await this.collection.findOne(filter as Document);
        if (!doc) return null;
        return { ...doc, _id: doc._id.toString() } as unknown as T;
    }

    /** Update a record by _id */
    async update(id: string, data: Partial<T>): Promise<void> {
        await this.collection.updateOne(
            { _id: new ObjectId(id) as unknown as Document['_id'] },
            { $set: { ...data, updated_at: new Date() } },
        );
    }

    /** Delete a record by _id */
    async delete(id: string): Promise<void> {
        await this.collection.deleteOne({ _id: new ObjectId(id) as unknown as Document['_id'] });
    }

    /** Upsert: update matching record or insert new */
    async upsert(filter: Partial<T>, data: Partial<T>): Promise<void> {
        await this.collection.updateOne(
            filter as Document,
            { $set: { ...data, updated_at: new Date() } },
            { upsert: true },
        );
    }
}

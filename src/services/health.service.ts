import { env } from '@config/env';
import { ai } from '@ai';
import { get_mongo } from '@connection/mongo/mongo.connection';
import { get_pg } from '@connection/pg/pg.connection';
import { logger } from '@utils/log.util';

/** Status of a single component */
export interface ComponentHealth {
    status: 'up' | 'down' | 'not_configured';
    type?: string;
    latency_ms?: number;
    error?: string;
}

/** Full health check response */
export interface HealthReport {
    status: 'healthy' | 'degraded' | 'unhealthy';
    type?: string;
    uptime_s: number;
    timestamp: string;
    components: {
        store: ComponentHealth;
        embed: ComponentHealth;
        chat: ComponentHealth;
    };
}

const start_time = Date.now();

/** Ping the store by running a trivial query */
async function check_store(): Promise<ComponentHealth> {
    const start = Date.now();
    try {
        if (env.STORE_TYPE === 'mongo') {
            const client = await get_mongo();
            await client.db().admin().ping();
        } else {
            const pool = get_pg();
            const c = await pool.connect();
            try { await c.query('SELECT 1'); }
            finally { c.release(); }
        }
        return { status: 'up', type: env.STORE_TYPE, latency_ms: Date.now() - start };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ error: message }, 'Health check: store is down');
        return { status: 'down', type: env.STORE_TYPE, latency_ms: Date.now() - start, error: message };
    }
}

/** Ping the embed model by embedding a trivial string */
async function check_embed(): Promise<ComponentHealth> {
    if (!env.EMBED_MODEL_PROVIDER) return { status: 'not_configured' };

    const start = Date.now();
    try {
        await ai.embed.embed('health');
        return { status: 'up', type: env.EMBED_MODEL_PROVIDER, latency_ms: Date.now() - start };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ error: message }, 'Health check: embed model is down');
        return { status: 'down', type: env.EMBED_MODEL_PROVIDER, latency_ms: Date.now() - start, error: message };
    }
}

/** Ping the chat model with a trivial prompt */
async function check_chat(): Promise<ComponentHealth> {
    if (!env.CHAT_MODEL_PROVIDER) return { status: 'not_configured' };

    const start = Date.now();
    try {
        await ai.chat.invoke('ping');
        return { status: 'up', type: env.CHAT_MODEL_PROVIDER, latency_ms: Date.now() - start };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.warn({ error: message }, 'Health check: chat model is down');
        return { status: 'down', type: env.CHAT_MODEL_PROVIDER, latency_ms: Date.now() - start, error: message };
    }
}

/** Run all health checks and build the report */
export async function health_check(): Promise<HealthReport> {
    const [store_health, embed_health, chat_health] = await Promise.all([
        check_store(),
        check_embed(),
        check_chat(),
    ]);

    const components = {
        store: store_health,
        embed: embed_health,
        chat: chat_health,
    };

    const active = Object.values(components).filter((c) => c.status !== 'not_configured');
    const any_down = active.some((c) => c.status === 'down');
    const all_down = active.every((c) => c.status === 'down');

    const status = all_down ? 'unhealthy' : any_down ? 'degraded' : 'healthy';

    return {
        status,
        uptime_s: Math.floor((Date.now() - start_time) / 1000),
        timestamp: new Date().toISOString(),
        components,
    };
}

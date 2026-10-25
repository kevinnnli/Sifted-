/**
 * Shared storage for serverless hosting (Vercel), where the local disk is temporary and every
 * function instance has its own memory. The whole database is kept as one JSON document in Redis,
 * next to a revision number so instances can cheaply tell when another one has written.
 */

export interface Snapshot {
  revision: number;
  data: unknown;
}

export interface RemoteStore {
  readRevision(): Promise<number>;
  read(): Promise<Snapshot | null>;
  write(snapshot: Snapshot): Promise<void>;
}

/** Where this server keeps its data; reported to the admin portal. */
export type StorageMode = 'file' | 'redis' | 'temporary';
export const storageInfo: { mode: StorageMode } = { mode: 'file' };

/**
 * Upstash Redis over its REST API. Vercel's Upstash integration sets KV_REST_API_URL /
 * KV_REST_API_TOKEN (older projects) or UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 */
export function redisStoreFromEnv(): RemoteStore | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new RedisStore(url, token, process.env.SIFTED_REDIS_KEY || 'sifted');
}

class RedisStore implements RemoteStore {
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly prefix: string
  ) {}

  private async command(args: string[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const body = (await res.json().catch(() => null)) as { result?: unknown; error?: string } | null;
    if (!res.ok || !body || body.error) throw new Error(`Redis ${args[0]} failed: ${body?.error || res.status}`);
    return body.result;
  }

  async readRevision() {
    const value = await this.command(['GET', `${this.prefix}:revision`]);
    return Number(value) || 0;
  }

  async read() {
    const value = await this.command(['GET', `${this.prefix}:database`]);
    if (typeof value !== 'string') return null;
    return JSON.parse(value) as Snapshot;
  }

  async write(snapshot: Snapshot) {
    // MSET is atomic: the revision never points past the document it describes
    await this.command(['MSET', `${this.prefix}:database`, JSON.stringify(snapshot), `${this.prefix}:revision`, String(snapshot.revision)]);
  }
}

import { LocalCacheInterface } from '@internetarchive/local-cache';

export class MockLocalCache implements LocalCacheInterface {
  storage: { [key: string]: any } = {};

  async set(options: {
    key: string;
    value: any;
    ttl?: number | undefined;
  }): Promise<void> {
    this.storage[options.key] = options.value;
  }

  async get(key: string): Promise<any> {
    return this.storage[key];
  }

  async delete(key: string): Promise<void> {
    delete this.storage[key];
  }

  async cleanExpired(): Promise<void> {
    // noop
  }
}

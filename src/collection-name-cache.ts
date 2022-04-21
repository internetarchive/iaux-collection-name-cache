/* eslint-disable camelcase */
/* eslint-disable no-continue */
import {
  SearchParams,
  SearchServiceInterface,
} from '@internetarchive/search-service';
import { LocalCacheInterface } from '@internetarchive/local-cache';

/**
 * The CollectionNameCache loads collection names from the search service and
 * caches them so they can be quickly retrieved later.
 *
 * It queues up many requests and resolves them in batches.
 */
export interface CollectionNameCacheInterface {
  /**
   * Get the name of a collection by its identifier.
   *
   * @param identifier
   */
  collectionNameFor(identifier: string): Promise<string | null>;

  /**
   * Preload many collection names for given identifiers.
   *
   * @param identifiers
   */
  preloadIdentifiers(identifiers: string[]): Promise<void>;
}

// this is the callback type received after the name is fetched
type CollectionNameResolver = (name: string | null) => Promise<void>;

// this stores the result of the lookup and when it was last accessed
// to help us prune old entries
interface CollectionNameStorage {
  name: string | null;
  lastAccess: number;
}

export class CollectionNameCache implements CollectionNameCacheInterface {
  private cacheKeyName = 'collection-name-cache';

  private cacheTtl = 60 * 60 * 24 * 7;

  private defaultPruningAge = 1000 * 60 * 60 * 24 * 7;

  private defaultPruningInterval = 1000 * 10;

  private defaultLoadInterval = 250; // ms

  /** @inheritdoc */
  async collectionNameFor(identifier: string): Promise<string | null> {
    if (!this.cacheLoaded) await this.loadFromCache();
    const lowercaseIdentifier = identifier.toLowerCase();
    const cachedName = this.collectionNameCache[lowercaseIdentifier];

    if (cachedName) {
      cachedName.lastAccess = Date.now();
      this.collectionNameCache[lowercaseIdentifier] = cachedName;
      return cachedName.name;
    }

    return new Promise(resolve => {
      this.pendingIdentifierQueue.push(lowercaseIdentifier);
      const currentPromises = this.pendingPromises[lowercaseIdentifier] ?? [];
      const resultHandler: CollectionNameResolver = async (
        name: string | null
      ) => {
        resolve(name);
      };
      currentPromises.push(resultHandler);
      this.pendingPromises[lowercaseIdentifier] = currentPromises;
    });
  }

  /** @inheritdoc */
  async preloadIdentifiers(identifiers: string[]): Promise<void> {
    if (!this.cacheLoaded) await this.loadFromCache();
    const lowercaseIdentifiers = identifiers.map(identifier =>
      identifier.toLowerCase()
    );
    for (const identifier of lowercaseIdentifiers) {
      if (this.collectionNameCache[identifier]) continue;
      this.pendingIdentifierQueue.push(identifier);
    }
    await this.loadPendingIdentifiers();
  }

  private pendingIdentifierQueue: string[] = [];

  private pendingPromises: { [identifier: string]: CollectionNameResolver[] } =
    {};

  private collectionNameCache: {
    [identifier: string]: CollectionNameStorage | undefined;
  } = {};

  private searchService: SearchServiceInterface;

  private localCache?: LocalCacheInterface;

  private pruningAge = this.defaultPruningAge;

  private cacheLoaded = false;

  constructor(options: {
    searchService: SearchServiceInterface;
    localCache?: LocalCacheInterface;
    loadInterval?: number;
    pruneInterval?: number;
    pruningAge?: number;
  }) {
    this.searchService = options.searchService;
    this.localCache = options.localCache;
    this.pruningAge = options.pruningAge ?? this.pruningAge;

    setInterval(async () => {
      await this.loadPendingIdentifiers();
    }, options.loadInterval ?? this.defaultLoadInterval);

    setInterval(async () => {
      await this.loadFromCache();
      await this.pruneCache();
    }, options.pruneInterval ?? this.defaultPruningInterval);
  }

  private async loadFromCache(): Promise<void> {
    if (!this.localCache || this.cacheLoaded) return;
    const cachedNames = await this.localCache.get(this.cacheKeyName);
    if (!cachedNames) return;
    this.collectionNameCache = cachedNames;
    this.cacheLoaded = true;
  }

  private async loadPendingIdentifiers(): Promise<void> {
    const pendingIdentifiers = this.pendingIdentifierQueue.splice(0, 100);
    if (pendingIdentifiers.length === 0) return;

    const searchParams = new SearchParams({
      query: `identifier:(${pendingIdentifiers.join(' OR ')})`,
      fields: ['title', 'identifier'],
      rows: pendingIdentifiers.length,
    });

    const results = await this.searchService.search(searchParams);
    const docs = results.success?.response?.docs;

    // first process the identifiers that were received from the search service
    // and remove them from the pendingIdentifierQueue
    if (docs && docs.length > 0) {
      for (const result of docs) {
        const { identifier, title } = result;
        if (!identifier) continue;
        const lowercaseIdentifier = identifier.toLowerCase();
        pendingIdentifiers.splice(
          pendingIdentifiers.indexOf(lowercaseIdentifier),
          1
        );
        const collectionName = title?.value ?? null;
        this.collectionNameCache[lowercaseIdentifier] = {
          name: collectionName,
          lastAccess: Date.now(),
        };
        const currentPromises = this.pendingPromises[lowercaseIdentifier];
        if (currentPromises) {
          for (const promise of currentPromises) {
            promise(collectionName);
          }
          delete this.pendingPromises[lowercaseIdentifier];
        }
      }
    }

    // if the search service did not return titles for all of the identifiers,
    // we still need to complete the promises and just return `null` for the rest
    for (const identifier of pendingIdentifiers) {
      this.collectionNameCache[identifier] = {
        name: null,
        lastAccess: Date.now(),
      };
      const currentPromises = this.pendingPromises[identifier];
      if (currentPromises) {
        for (const promise of currentPromises) {
          promise(null);
        }
        delete this.pendingPromises[identifier];
      }
    }

    await this.localCache?.set({
      key: this.cacheKeyName,
      value: this.collectionNameCache,
      ttl: this.cacheTtl,
    });
  }

  async pruneCache(): Promise<void> {
    // prune old entries from the cache
    const now = Date.now();

    for (const [identifier, storageInfo] of Object.entries(
      this.collectionNameCache
    )) {
      if (!storageInfo) continue;
      const { lastAccess } = storageInfo;
      if (lastAccess < now - this.pruningAge) {
        delete this.collectionNameCache[identifier];
      }
    }

    await this.localCache?.set({
      key: this.cacheKeyName,
      value: this.collectionNameCache,
      ttl: this.cacheTtl,
    });
  }
}

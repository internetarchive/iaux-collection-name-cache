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

  private defaultLoadDelay = 100; // ms

  // we want to let identifiers accumulate in the queue before we start
  // loading them from the search service so this is how long we wait until we start loading
  private loadDelay = 100; // ms

  private defaultPruningAge = 1000 * 60 * 60 * 24 * 7;

  private defaultPruningInterval = 1000 * 30;

  private fetchTimeout: number | null = null;

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

    this.startPendingIdentifierTimer();

    return new Promise(resolve => {
      this.pendingIdentifierQueue.add(lowercaseIdentifier);
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
      this.pendingIdentifierQueue.add(identifier);
    }
    this.startPendingIdentifierTimer();
  }

  private pendingIdentifierQueue: Set<string> = new Set<string>();

  private pendingPromises: { [identifier: string]: CollectionNameResolver[] } =
    {};

  private collectionNameCache: {
    [identifier: string]: CollectionNameStorage | undefined;
  } = {};

  private searchService: SearchServiceInterface;

  private localCache?: LocalCacheInterface;

  private pruningAge = this.defaultPruningAge;

  private maxCacheSize = 2500;

  private cacheLoaded = false;

  constructor(options: {
    searchService: SearchServiceInterface;
    maxCacheSize?: number;
    localCache?: LocalCacheInterface;
    loadDelay?: number;
    pruneInterval?: number;
    pruningAge?: number;
  }) {
    this.searchService = options.searchService;
    this.localCache = options.localCache;
    this.loadDelay = options.loadDelay ?? this.defaultLoadDelay;
    this.pruningAge = options.pruningAge ?? this.pruningAge;
    this.maxCacheSize = options.maxCacheSize ?? this.maxCacheSize;

    this.pruneCache();
    setInterval(async () => {
      await this.pruneCache();
    }, options.pruneInterval ?? this.defaultPruningInterval);
  }

  private async startPendingIdentifierTimer(): Promise<void> {
    if (this.fetchTimeout) return;
    this.fetchTimeout = window.setTimeout(() => {
      this.loadPendingIdentifiers();
      this.fetchTimeout = null;
    }, this.loadDelay);
  }

  private async loadFromCache(): Promise<void> {
    if (!this.localCache || this.cacheLoaded) return;
    const cachedNames = await this.localCache.get(this.cacheKeyName);
    if (!cachedNames) return;
    this.collectionNameCache = cachedNames;
    this.cacheLoaded = true;
  }

  private async loadPendingIdentifiers(): Promise<void> {
    await this.loadFromCache();
    const pendingIdentifiers = Array.from(this.pendingIdentifierQueue).splice(
      0,
      100
    );
    if (pendingIdentifiers.length === 0) return;
    pendingIdentifiers.map(async identifier =>
      this.pendingIdentifierQueue.delete(identifier)
    );

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

    await this.persistCache();
  }

  // prune entries from the cache
  async pruneCache(): Promise<void> {
    await this.loadFromCache();

    const now = Date.now();

    // sorting the keys by lastAccess ascending so we can remove the oldest
    const sortedCache = Object.entries(this.collectionNameCache).sort(
      (a, b) => {
        const aLastAccess = a[1]?.lastAccess ?? 0;
        const bLastAccess = b[1]?.lastAccess ?? 0;
        return aLastAccess - bLastAccess;
      }
    );

    const identifiersToDelete = new Set<string>();
    for (const [identifier, storageInfo] of sortedCache) {
      if (!storageInfo) continue;
      const { lastAccess } = storageInfo;
      if (lastAccess < now - this.pruningAge) {
        identifiersToDelete.add(identifier);
      }
    }

    // delete oldest identifiers if number is greater than maxCacheSize
    if (sortedCache.length > this.maxCacheSize) {
      for (let i = 0; i < sortedCache.length - this.maxCacheSize; i += 1) {
        const [identifier] = sortedCache[i];
        identifiersToDelete.add(identifier);
      }
    }

    // delete the identifiers from the cache
    for (const identifier of identifiersToDelete) {
      delete this.collectionNameCache[identifier];
    }

    await this.persistCache();
  }

  private async persistCache(): Promise<void> {
    await this.localCache?.set({
      key: this.cacheKeyName,
      value: this.collectionNameCache,
      ttl: this.cacheTtl,
    });
  }
}

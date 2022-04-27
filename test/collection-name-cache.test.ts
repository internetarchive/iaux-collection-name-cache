import { expect } from '@open-wc/testing';
import { CollectionNameCache } from '../src/collection-name-cache';
import { MockLocalCache } from './mocks/mock-local-cache';
import {
  mockSearchResponse,
  mockSearchResponseOnlyFoo,
} from './mocks/mock-search-response';
import { MockSearchService } from './mocks/mock-search-service';
import { promisedSleep } from './promised-sleep';

describe('CollectionNameCache', () => {
  it('generates proper query for requested identifiers', async () => {
    const mockSearchService = new MockSearchService();
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 50,
    });

    await Promise.all([
      collectionNameFetcher.collectionNameFor('foo-collection'),
      collectionNameFetcher.collectionNameFor('bar-collection'),
      collectionNameFetcher.collectionNameFor('baz-collection'),
    ]);

    expect(mockSearchService.searchParams?.query).to.equal(
      'identifier:(foo-collection OR bar-collection OR baz-collection)'
    );
    expect(mockSearchService.searchParams?.rows).to.equal(3);
    expect(mockSearchService.searchParams?.fields).to.deep.equal([
      'title',
      'identifier',
    ]);
    expect(mockSearchService.searchCallCount).to.equal(1);
  });

  it('returns proper names once load is complete', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 50,
    });

    const results = await Promise.all([
      collectionNameFetcher.collectionNameFor('foo-collection'),
      collectionNameFetcher.collectionNameFor('bar-collection'),
      collectionNameFetcher.collectionNameFor('baz-collection'),
    ]);

    expect(results[0]).to.equal('Foo Collection');
    expect(results[1]).to.equal('Bar Collection');
    expect(results[2]).to.equal('Baz Collection');
  });

  it('resolves all of the requests even if a name is missing', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponseOnlyFoo;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 50,
    });

    const results = await Promise.all([
      collectionNameFetcher.collectionNameFor('foo-collection'),
      collectionNameFetcher.collectionNameFor('bar-collection'),
      collectionNameFetcher.collectionNameFor('baz-collection'),
    ]);

    expect(results[0]).to.equal('Foo Collection');
    expect(results[1]).to.equal(null);
    expect(results[2]).to.equal(null);
  });

  it('returns the cached name if available', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 50,
    });

    await Promise.all([
      collectionNameFetcher.collectionNameFor('foo-collection'),
      collectionNameFetcher.collectionNameFor('bar-collection'),
      collectionNameFetcher.collectionNameFor('baz-collection'),
    ]);

    // make one more request, but this time there should be no network request
    await collectionNameFetcher.collectionNameFor('foo-collection');

    expect(mockSearchService.searchCallCount).to.equal(1);
  });

  it('returns multiple requests for the same identifier', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponseOnlyFoo;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 50,
    });

    const results = await Promise.all([
      collectionNameFetcher.collectionNameFor('foo-collection'),
      collectionNameFetcher.collectionNameFor('foo-collection'),
      collectionNameFetcher.collectionNameFor('foo-collection'),
    ]);

    expect(results[0]).to.equal('Foo Collection');
    expect(results[1]).to.equal('Foo Collection');
    expect(results[2]).to.equal('Foo Collection');
  });

  it('can preload a bunch of identifiers', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 25,
    });

    await collectionNameFetcher.preloadIdentifiers([
      'foo-collection',
      'bar-collection',
      'baz-collection',
    ]);

    await promisedSleep(50);

    // should have loaded here
    expect(mockSearchService.searchCallCount).to.equal(1);

    const results = await Promise.all([
      collectionNameFetcher.collectionNameFor('foo-collection'),
      collectionNameFetcher.collectionNameFor('bar-collection'),
      collectionNameFetcher.collectionNameFor('baz-collection'),
    ]);

    // these should all be cached
    expect(results[0]).to.equal('Foo Collection');
    expect(results[1]).to.equal('Bar Collection');
    expect(results[2]).to.equal('Baz Collection');

    // no additional call should have been made
    expect(mockSearchService.searchCallCount).to.equal(1);
  });

  it('does not make another request when preloading if name is already cached', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 25,
    });

    await collectionNameFetcher.preloadIdentifiers([
      'foo-collection',
      'bar-collection',
      'baz-collection',
    ]);

    await promisedSleep(50);

    // should have loaded here
    expect(mockSearchService.searchCallCount).to.equal(1);

    await collectionNameFetcher.preloadIdentifiers(['foo-collection']);

    // no additional call should have been made
    expect(mockSearchService.searchCallCount).to.equal(1);
  });

  it('preloads identifiers that have not yet been cached', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 25,
    });

    await collectionNameFetcher.preloadIdentifiers([
      'foo-collection',
      'bar-collection',
      'baz-collection',
    ]);

    await promisedSleep(50);

    // should have loaded here
    expect(mockSearchService.searchCallCount).to.equal(1);

    await collectionNameFetcher.preloadIdentifiers([
      'foo-collection',
      'beep-collection',
    ]);

    // the query won't fire until the load delay has passed (25ms) so wait for it
    await promisedSleep(50);

    expect(mockSearchService.searchParams?.query).to.equal(
      'identifier:(beep-collection)'
    );

    // no additional call should have been made
    expect(mockSearchService.searchCallCount).to.equal(2);
  });

  it('prunes old cache items', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 25,
      pruneInterval: 20,
      pruningAge: 80,
    });

    await collectionNameFetcher.preloadIdentifiers([
      'foo-collection',
      'bar-collection',
      'baz-collection',
    ]);

    await promisedSleep(50);

    expect(mockSearchService.searchCallCount).to.equal(1);
    await promisedSleep(50);
    await collectionNameFetcher.collectionNameFor('foo-collection');

    // no additional requests should have been made
    expect(mockSearchService.searchCallCount).to.equal(1);

    // waiting 100 ms for the cache to be pruned
    await promisedSleep(100);

    await collectionNameFetcher.collectionNameFor('foo-collection');

    // another call should have been made since the cache was pruned
    expect(mockSearchService.searchCallCount).to.equal(2);
  });

  it('removes old items if caches gets too big', async () => {
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      loadDelay: 110,
      pruneInterval: 150,
      maxCacheSize: 2,
    });

    // add some time in-between so the timestamps aren't all identical
    await collectionNameFetcher.collectionNameFor('foo-collection');
    await promisedSleep(50);
    await collectionNameFetcher.collectionNameFor('bar-collection');
    await promisedSleep(50);
    await collectionNameFetcher.collectionNameFor('baz-collection');

    expect(mockSearchService.searchCallCount).to.equal(1);

    // waiting 60ms for the pruner to come through and prune the cache, which should remove the first item
    // since our max size is 2
    await promisedSleep(60);

    // first check the bar-collection, which should not have been pruned so we still only have 1 request
    await collectionNameFetcher.collectionNameFor('bar-collection');
    expect(mockSearchService.searchCallCount).to.equal(1);

    // now we're going to fetch the one that should have been pruned so we should see another request
    await collectionNameFetcher.collectionNameFor('foo-collection');

    // wait to make sure the load delay elapses
    await promisedSleep(120);

    // and another request had to be made
    expect(mockSearchService.searchCallCount).to.equal(2);
  });

  it('can persist the cache to localCache', async () => {
    const mockLocalCache = new MockLocalCache();
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      localCache: mockLocalCache,
      loadDelay: 25,
    });

    await collectionNameFetcher.collectionNameFor('foo-collection');
    await collectionNameFetcher.collectionNameFor('bar-collection');
    await collectionNameFetcher.collectionNameFor('baz-collection');

    // wait for the load to occur
    await promisedSleep(50);

    expect(
      mockLocalCache.storage['collection-name-cache']['bar-collection'].name
    ).to.equal('Bar Collection');
    expect(
      mockLocalCache.storage['collection-name-cache']['foo-collection'].name
    ).to.equal('Foo Collection');
    expect(
      mockLocalCache.storage['collection-name-cache']['baz-collection'].name
    ).to.equal('Baz Collection');
  });

  it('will use localCache data if available', async () => {
    const mockLocalCache = new MockLocalCache();
    mockLocalCache.storage['collection-name-cache'] = {
      'foo-collection': {
        name: 'Foo Collection',
        timestamp: Date.now(),
      },
      'bar-collection': {
        name: 'Bar Collection',
        lastAccess: Date.now(),
      },
    };
    const mockSearchService = new MockSearchService();
    mockSearchService.searchResult = mockSearchResponse;
    const collectionNameFetcher = new CollectionNameCache({
      searchService: mockSearchService,
      localCache: mockLocalCache,
      loadDelay: 25,
    });

    await collectionNameFetcher.collectionNameFor('foo-collection');
    await collectionNameFetcher.collectionNameFor('bar-collection');
    await promisedSleep(50);
    expect(mockSearchService.searchCallCount).to.equal(0);

    // this is not in the cache
    await collectionNameFetcher.collectionNameFor('baz-collection');

    // wait for the load to occur
    await promisedSleep(50);
    expect(mockSearchService.searchCallCount).to.equal(1);

    expect(
      mockLocalCache.storage['collection-name-cache']['baz-collection'].name
    ).to.equal('Baz Collection');
  });
});

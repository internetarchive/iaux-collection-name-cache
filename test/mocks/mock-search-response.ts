import { ItemHit, SearchResponse } from '@internetarchive/search-service';
import type { SearchServiceError } from '@internetarchive/search-service/dist/src/search-service-error';
import type { Result } from '@internetarchive/result-type';

export const mockSearchResponse: Result<SearchResponse, SearchServiceError> = {
  success: {
    request: {
      clientParameters: {},
      finalizedParameters: {},
    },
    responseHeader: {
      succeeded: true,
      query_time: 0,
    },
    rawResponse: {},
    response: {
      totalResults: 3,
      returnedCount: 3,
      results: [
        new ItemHit({
          fields: {
            identifier: 'foo-collection',
            title: 'Foo Collection',
          },
        }),
        new ItemHit({
          fields: {
            identifier: 'bar-collection',
            title: 'Bar Collection',
          },
        }),
        new ItemHit({
          fields: {
            identifier: 'baz-collection',
            title: 'Baz Collection',
          },
        }),
      ],
    },
  },
};

export const mockSearchResponseOnlyFoo: Result<
  SearchResponse,
  SearchServiceError
> = {
  success: {
    request: {
      clientParameters: {},
      finalizedParameters: {},
    },
    responseHeader: {
      succeeded: true,
      query_time: 0,
    },
    rawResponse: {},
    response: {
      totalResults: 3,
      returnedCount: 1,
      results: [
        new ItemHit({
          fields: {
            identifier: 'foo-collection',
            title: 'Foo Collection',
          },
        }),
      ],
    },
  },
};

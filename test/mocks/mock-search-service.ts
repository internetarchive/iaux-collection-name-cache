import { Result } from '@internetarchive/result-type';
import {
  SearchParams,
  SearchResponse,
  SearchServiceInterface,
} from '@internetarchive/search-service';
import { SearchServiceError } from '@internetarchive/search-service/dist/src/search-service-error';

export class MockSearchService implements SearchServiceInterface {
  searchParams?: SearchParams;

  searchCallCount = 0;

  searchResult?: Result<SearchResponse, SearchServiceError>;

  search(
    params: SearchParams
  ): Promise<Result<SearchResponse, SearchServiceError>> {
    this.searchParams = params;
    this.searchCallCount += 1;
    return Promise.resolve(this.searchResult ?? { success: undefined });
  }
}

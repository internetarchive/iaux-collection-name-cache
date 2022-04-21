import { SearchService } from '@internetarchive/search-service';
import { LocalCache } from '@internetarchive/local-cache';
import { html, css, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../src/async-collection-name';
import { CollectionNameCache } from '../src/collection-name-cache';

@customElement('app-root')
export class AppRoot extends LitElement {
  searchService = SearchService.default;

  localCache = new LocalCache();

  collectionNameCache = new CollectionNameCache({
    searchService: this.searchService,
    localCache: this.localCache,
  });

  render() {
    return html`
      <async-collection-name
        .collectionNameCache=${this.collectionNameCache}
        .identifier=${'gratefuldead'}
      ></async-collection-name>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
  `;
}

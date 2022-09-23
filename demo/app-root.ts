import { SearchService } from '@internetarchive/search-service';
import { LocalCache } from '@internetarchive/local-cache';
import { html, css, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import '../src/async-collection-name';
import { CollectionNameCache } from '../src/collection-name-cache';

@customElement('app-root')
export class AppRoot extends LitElement {
  @state()
  private identifier = 'gratefuldead';

  @query('#coll-id-input')
  private identifierInput!: HTMLInputElement;

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
        .identifier=${this.identifier}
      ></async-collection-name>

      <form @submit=${this.onFormSubmit}>
        <label for="coll-id-input">Load new collection name: </label>
        <input type="text" id="coll-id-input" />
        <button type="submit">Go</button>
      </form>
    `;
  }

  private onFormSubmit(e: Event): void {
    e.preventDefault();
    if (this.identifierInput.value) {
      this.identifier = this.identifierInput.value;
      this.identifierInput.value = '';
    }
  }

  static styles = css`
    :host {
      display: block;
      font-size: 1.6rem;
    }
  `;
}

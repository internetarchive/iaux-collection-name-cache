import { html, LitElement, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CollectionNameCacheInterface } from './collection-name-cache';

@customElement('async-collection-name')
export class AsyncCollectionName extends LitElement {
  @property({ type: Object })
  collectionNameCache?: CollectionNameCacheInterface;

  @property({ type: String }) identifier?: string;

  @state() name?: string | null;

  render() {
    return html` ${this.name ? this.name : this.identifier} `;
  }

  // disable the shadowRoot for this component so consumers can style it as they need
  protected createRenderRoot(): Element | ShadowRoot {
    return this;
  }

  updated(changed: PropertyValues): void {
    if (changed.has('identifier') || changed.has('collectionNameCache')) {
      this.fetchName();
    }
  }

  private async fetchName(): Promise<void> {
    if (!this.identifier || !this.collectionNameCache) return;
    this.name = await this.collectionNameCache.collectionNameFor(
      this.identifier
    );
  }
}

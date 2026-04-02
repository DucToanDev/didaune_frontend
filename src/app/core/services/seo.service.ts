import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { SEO_CONFIG } from '../config/seo.config';

interface SeoPayload {
  title?: string;
  description?: string;
  path?: string;
  image?: string | null;
  type?: string;
  keywords?: string[];
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>> | null;
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly jsonLdId = 'app-seo-jsonld';

  constructor(
    private readonly title: Title,
    private readonly meta: Meta,
    @Inject(DOCUMENT) private readonly document: Document,
  ) {}

  setPage(payload: SeoPayload) {
    const pageTitle = payload.title?.trim() || SEO_CONFIG.defaultTitle;
    const fullTitle = pageTitle.includes(SEO_CONFIG.siteName)
      ? pageTitle
      : `${pageTitle} | ${SEO_CONFIG.siteName}`;
    const description =
      payload.description?.trim() || SEO_CONFIG.defaultDescription;
    const pageUrl = this.resolveUrl(payload.path);
    const imageUrl = this.resolveUrl(payload.image || SEO_CONFIG.defaultImage);
    const robots = payload.noindex ? 'noindex,nofollow' : 'index,follow';

    this.title.setTitle(fullTitle);
    this.updateTag('name', 'description', description);
    this.updateTag('name', 'keywords', (payload.keywords ?? []).join(', '));
    this.updateTag('name', 'robots', robots);
    this.updateTag('property', 'og:title', fullTitle);
    this.updateTag('property', 'og:description', description);
    this.updateTag('property', 'og:url', pageUrl);
    this.updateTag('property', 'og:type', payload.type || 'website');
    this.updateTag('property', 'og:image', imageUrl);
    this.updateTag('name', 'twitter:card', SEO_CONFIG.twitterCard);
    this.updateTag('name', 'twitter:title', fullTitle);
    this.updateTag('name', 'twitter:description', description);
    this.updateTag('name', 'twitter:image', imageUrl);
    this.updateCanonical(pageUrl);
    this.updateJsonLd(payload.jsonLd ?? null);
  }

  clearJsonLd() {
    const existing = this.document.getElementById(this.jsonLdId);
    if (existing?.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  private updateTag(
    attrName: 'name' | 'property',
    attrValue: string,
    content: string,
  ) {
    if (!content) {
      return;
    }

    this.meta.updateTag({
      [attrName]: attrValue,
      content,
    });
  }

  private updateCanonical(url: string) {
    let link = this.document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;

    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

  private updateJsonLd(value: SeoPayload['jsonLd']) {
    this.clearJsonLd();

    if (!value) {
      return;
    }

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = this.jsonLdId;
    script.text = JSON.stringify(value);
    this.document.head.appendChild(script);
  }

  private resolveUrl(path?: string | null): string {
    if (!path) {
      return SEO_CONFIG.siteUrl;
    }

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    return `${SEO_CONFIG.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}

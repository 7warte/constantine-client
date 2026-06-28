import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService } from '../services/api.service';
import {
  BADGES, BadgeDef, BadgeStats, BadgeStatus, allBadgeStatuses,
} from './badge-catalog';

/**
 * Loads the current user's raw stats once and derives badge earned/progress
 * state from the static catalog. Stats are cached for the session; call
 * load() again to refresh.
 */
@Injectable({ providedIn: 'root' })
export class BadgeService {
  private readonly api = inject(ApiService);

  readonly stats   = signal<BadgeStats | null>(null);
  readonly loading = signal(false);
  private loaded = false;

  readonly statuses = computed<BadgeStatus[]>(() => allBadgeStatuses(this.stats()));
  readonly earned   = computed(() => this.statuses().filter(s => s.earned));
  readonly earnedCount = computed(() => this.earned().length);
  readonly totalCount  = BADGES.length;

  /** Fetch stats once (no-op if already loaded, unless force). */
  load(force = false): void {
    if (this.loaded && !force) return;
    this.loaded = true;
    this.loading.set(true);
    this.api.get<BadgeStats>('/users/me/stats').subscribe({
      next: s => { this.stats.set(s); this.loading.set(false); },
      error: () => { this.loading.set(false); },
    });
  }

  /** Build a fun share caption for an earned badge. */
  shareCaption(def: BadgeDef): string {
    return `I just earned the “${def.name}” badge on Constantine Tours — ${def.hint} 🏛️`;
  }

  /** Public badges page URL (deep-linked to the badge). */
  shareUrl(def: BadgeDef): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/badges#${def.id}`;
  }

  /**
   * Share a badge. Uses the native share sheet when available, otherwise opens
   * an X/Twitter intent in a new tab.
   */
  share(def: BadgeDef): void {
    const text = this.shareCaption(def);
    const url = this.shareUrl(def);
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : null;
    if (nav?.share) {
      nav.share({ title: 'Constantine Tours', text, url }).catch(() => { /* user cancelled */ });
      return;
    }
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    if (typeof window !== 'undefined') window.open(intent, '_blank', 'noopener,noreferrer');
  }
}

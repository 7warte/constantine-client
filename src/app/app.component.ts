import { Component, effect, inject, signal, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';
import { OfflineService } from './core/offline/offline.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
    @if (offline.offlineMode()) {
      <div class="offline-bar" role="status">
        <span class="offline-bar__dot"></span>
        You're offline — viewing your saved tour<span class="offline-bar__title"> · {{ offline.saved()?.title }}</span>
      </div>
    }
    <main class="main-content">
      <router-outlet />
    </main>
    @if (showFooter()) {
      <app-footer />
    }
  `,
  styles: [`
    /* Sticky-footer column: the main area grows to fill, the footer is always
       pinned after it — content can never scroll behind the footer. */
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
    .main-content {
      flex: 1 0 auto;
    }
    /* Offline reminder bar, pinned just under the sticky navbar. */
    .offline-bar {
      position: sticky;
      top: 64px;
      z-index: 90;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 7px 14px;
      background: #2b2424;
      color: #ffffff;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
    }
    .offline-bar__dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #f57c00;
      flex-shrink: 0;
    }
    .offline-bar__title { font-weight: 400; opacity: 0.85; }
  `],
})
export class AppComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  readonly offline = inject(OfflineService);

  // The marketing footer is hidden in the full-height app workspaces — the
  // creator studio and the tour player — which have their own internal scroll
  // and where a footer below would just sit behind the scrolling content.
  readonly showFooter = signal(true);

  constructor() {
    // When the device goes offline, the only thing available is the saved tour —
    // so send the user straight to it (it becomes their "home").
    effect(() => {
      if (!this.offline.offlineMode()) return;
      const rec = this.offline.saved();
      if (!rec) return;
      const target = `/library/${rec.purchaseId}/play`;
      if (!this.router.url.startsWith(target)) this.router.navigateByUrl(target);
    });
  }

  ngOnInit(): void {
    this.auth.init();

    const fullHeightRoute = /^\/(studio|library\/[^/]+\/play)\b/;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.showFooter.set(!fullHeightRoute.test(e.urlAfterRedirects)));
  }
}

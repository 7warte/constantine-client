import { Component, effect, inject, signal, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd, NavigationStart, RouterOutlet } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
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
    @if (updateReady()) {
      <div class="update-toast" role="status">
        A new version is available.
        <button type="button" class="update-toast__btn" (click)="reloadForUpdate()">Reload</button>
      </div>
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
    /* "New version available" toast, bottom-centered. */
    .update-toast {
      position: fixed;
      left: 50%;
      bottom: 20px;
      transform: translateX(-50%);
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      background: #2b2424;
      color: #ffffff;
      border-radius: 999px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
      font-size: 14px;
      max-width: calc(100vw - 24px);
    }
    .update-toast__btn {
      background: #f57c00;
      color: #ffffff;
      border: none;
      border-radius: 999px;
      padding: 6px 14px;
      font-weight: 600;
      cursor: pointer;
    }
  `],
})
export class AppComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly swUpdate = inject(SwUpdate);
  readonly offline = inject(OfflineService);

  // The marketing footer is hidden in the full-height app workspaces — the
  // creator studio and the tour player — which have their own internal scroll
  // and where a footer below would just sit behind the scrolling content.
  readonly showFooter = signal(true);
  /** A newer app version has been downloaded by the service worker. */
  readonly updateReady = signal(false);

  constructor() {
    // When the device goes offline, the only thing available is the saved tour —
    // so send the user straight to it (it becomes their "home"). This effect
    // covers the moment the connection drops while sitting on a page.
    effect(() => {
      if (!this.offline.offlineMode()) return;
      const rec = this.offline.saved();
      if (!rec) return;
      const target = `/library/${rec.purchaseId}/play`;
      if (!this.router.url.startsWith(target)) this.router.navigateByUrl(target);
    });

    // While already offline, any navigation away from the saved tour — the back
    // button, the brand logo, a stray link — would land on a page that needs the
    // network. Reroute every such navigation back to the player. Caught on
    // NavigationStart so the target page never activates.
    this.router.events.pipe(
      filter((e): e is NavigationStart => e instanceof NavigationStart),
      takeUntilDestroyed(),
    ).subscribe(e => {
      if (!this.offline.offlineMode()) return;
      const rec = this.offline.saved();
      if (!rec) return;
      const target = `/library/${rec.purchaseId}/play`;
      if (!e.url.startsWith(target)) this.router.navigateByUrl(target);
    });

    // Surface a "reload for the new version" prompt when the SW has one ready.
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter(e => e.type === 'VERSION_READY'),
        takeUntilDestroyed(),
      ).subscribe(() => this.updateReady.set(true));
    }
  }

  reloadForUpdate(): void {
    this.swUpdate.activateUpdate().then(() => document.location.reload());
  }

  ngOnInit(): void {
    this.auth.init();

    const fullHeightRoute = /^\/(studio|library\/[^/]+\/play)\b/;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.showFooter.set(!fullHeightRoute.test(e.urlAfterRedirects)));
  }
}

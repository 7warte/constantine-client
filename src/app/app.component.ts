import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  template: `
    <app-navbar />
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
  `],
})
export class AppComponent implements OnInit {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);

  // The marketing footer is hidden in the full-height app workspaces — the
  // creator studio and the tour player — which have their own internal scroll
  // and where a footer below would just sit behind the scrolling content.
  readonly showFooter = signal(true);

  ngOnInit(): void {
    this.auth.init();

    const fullHeightRoute = /^\/(studio|library\/[^/]+\/play)\b/;
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.showFooter.set(!fullHeightRoute.test(e.urlAfterRedirects)));
  }
}

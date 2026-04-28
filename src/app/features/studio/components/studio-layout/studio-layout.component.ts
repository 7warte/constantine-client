import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-studio-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatListModule, MatIconModule, MatToolbarModule, MatButtonModule,
  ],
  templateUrl: './studio-layout.component.html',
  styleUrl: './studio-layout.component.scss',
})
export class StudioLayoutComponent {
  readonly sidenavOpen = signal(true);

  readonly navItems: NavItem[] = [
    { label: 'Your tours', icon: 'map', route: '/studio/tours' },
    { label: 'Earnings', icon: 'account_balance_wallet', route: '/studio/earnings' },
  ];

  toggleSidenav(): void {
    this.sidenavOpen.update(v => !v);
  }
}

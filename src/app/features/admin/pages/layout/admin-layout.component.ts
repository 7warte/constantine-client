import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AdminAuthService } from '../../admin-auth.service';

interface NavItem { label: string; icon: string; path: string; }
interface NavSection { label: string; items: NavItem[]; }

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly auth   = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly collapsed = signal(false);

  readonly sections: NavSection[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', icon: 'dashboard', path: '/admin/overview' },
        { label: 'Users',     icon: 'people',    path: '/admin/users' },
        { label: 'Tours',     icon: 'map',       path: '/admin/tours' },
      ],
    },
    {
      label: 'Money',
      items: [
        { label: 'Money flow', icon: 'payments',          path: '/admin/money-flow' },
        { label: 'Refunds',    icon: 'undo',              path: '/admin/refunds' },
        { label: 'Taxes (NL)', icon: 'request_quote',     path: '/admin/taxes' },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Tickets',           icon: 'support_agent', path: '/admin/tickets' },
        { label: 'Reports',           icon: 'flag',          path: '/admin/reports' },
        { label: 'Translation jobs',  icon: 'translate',     path: '/admin/translation-jobs' },
        { label: 'To-do list',        icon: 'checklist',     path: '/admin/todos' },
      ],
    },
    {
      label: 'System',
      items: [
        { label: 'Error logs',           icon: 'bug_report',   path: '/admin/error-logs' },
        { label: 'Email log',            icon: 'mail',         path: '/admin/email-logs' },
        { label: 'Terms & conditions',   icon: 'gavel',        path: '/admin/legal/terms' },
        { label: 'Privacy policy',       icon: 'shield',       path: '/admin/legal/privacy' },
        { label: 'FAQs',                 icon: 'help_outline', path: '/admin/faqs' },
        { label: 'Homepage media',       icon: 'movie',        path: '/admin/homepage-media' },
        { label: 'Resources',            icon: 'monitoring',   path: '/admin/resources' },
      ],
    },
    {
      label: 'Analytics',
      items: [
        { label: 'Visitors', icon: 'insights', path: '/admin/analytics' },
      ],
    },
  ];

  toggleCollapse(): void { this.collapsed.update(v => !v); }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/admin/login'),
    });
  }
}

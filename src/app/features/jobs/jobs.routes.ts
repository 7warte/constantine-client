import { Routes } from '@angular/router';

export const JOBS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/jobs-list/jobs-list.component').then(m => m.JobsListComponent),
  },
  {
    path: 'earnings',
    loadComponent: () => import('./pages/jobs-earnings/jobs-earnings.component').then(m => m.JobsEarningsComponent),
  },
  {
    path: ':jobId',
    loadComponent: () => import('./pages/job-workspace/job-workspace.component').then(m => m.JobWorkspaceComponent),
  },
];

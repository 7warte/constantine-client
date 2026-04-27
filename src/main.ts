import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

const ACCESS_PASSWORD = 'Bzn-K7m!Trv-4276';
const STORAGE_KEY = 'constantine_access_granted';

function gateAccess(): boolean {
  if (localStorage.getItem(STORAGE_KEY) === '1') return true;

  const input = prompt('Enter access password');
  if (input === ACCESS_PASSWORD) {
    localStorage.setItem(STORAGE_KEY, '1');
    return true;
  }

  document.body.innerHTML =
    '<div style="font-family:sans-serif;padding:48px;color:#111;">Access denied. Reload to try again.</div>';
  return false;
}

if (gateAccess()) {
  bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
}

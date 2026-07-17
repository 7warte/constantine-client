import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

interface Benefit {
  icon: string;
  title: string;
  blurb: string;
}

@Component({
  selector: 'app-downloads',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatIconModule, RouterLink],
  templateUrl: './downloads.component.html',
  styleUrl: './downloads.component.scss',
})
export class DownloadsComponent {
  /**
   * The App Store listing for the iOS app (App Store Connect id 6791914126).
   *
   * `released` gates the store button: until the app is publicly released it is
   * TestFlight-only, and this URL 404s. Flip `released` to true on launch day —
   * the link is already correct.
   */
  readonly appStoreUrl = 'https://apps.apple.com/app/id6791914126';
  readonly released = false;

  readonly benefits: Benefit[] = [
    {
      icon: 'my_location',
      title: 'Guided by where you are',
      blurb:
        'Stops unlock as you reach them, with a compass pointing to the next one. Keep your phone in your pocket and just listen.',
    },
    {
      icon: 'cloud_off',
      title: 'Works without signal',
      blurb:
        'Save a tour to your phone before you set off. The audio, the map and every stop stay with you — no roaming, no dead spots.',
    },
    {
      icon: 'qr_code_2',
      title: 'Share in person',
      blurb:
        'Travelling together? Scan a friend’s QR code to pass a tour straight to them — no typing out email addresses.',
    },
    {
      icon: 'headphones',
      title: 'Your library, everywhere',
      blurb:
        'Every tour you own is on your phone the moment you buy it, ready to start whenever you arrive.',
    },
    {
      icon: 'military_tech',
      title: 'Collect badges as you walk',
      blurb:
        'Earn badges for the distance you cover, the tours you finish and the cities you explore.',
    },
    {
      icon: 'mic',
      title: 'Create tours on the move',
      blurb:
        'Record narration on location, drop pins where you stand and publish from the Studio — without opening a laptop.',
    },
  ];
}

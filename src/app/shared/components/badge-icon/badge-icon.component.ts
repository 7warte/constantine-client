import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Round, monochrome line-art badge. Renders a shared circular frame plus a
 * per-family motif (selected by `icon`) and a short `label` (e.g. "5", "10h",
 * "€500"). `earned` toggles the inked vs greyed-out (locked) look.
 */
@Component({
  selector: 'app-badge-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="badge-icon" [class.badge-icon--earned]="earned()" [class.badge-icon--locked]="!earned()"
      [style.width.px]="size()" [style.height.px]="size()"
      viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" [attr.aria-label]="alt()">

      <defs>
        <linearGradient [attr.id]="'bgrad-' + gradId()" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" [attr.stop-color]="from()"/>
          <stop offset="1" [attr.stop-color]="to()"/>
        </linearGradient>
      </defs>

      <!-- frame -->
      <circle class="badge-icon__disc" cx="50" cy="50" r="48" [attr.fill]="'url(#bgrad-' + gradId() + ')'"/>
      <circle class="badge-icon__ring" cx="50" cy="50" r="43" fill="none"/>
      <g class="badge-icon__art" fill="none" stroke-linecap="round" stroke-linejoin="round">
        @switch (icon()) {
          @case ('ticket') {
            <rect x="30" y="31" width="40" height="22" rx="3"/>
            <line x1="44" y1="31" x2="44" y2="53" stroke-dasharray="3 3"/>
            <circle cx="37" cy="42" r="2"/>
          }
          @case ('compass') {
            <circle cx="50" cy="41" r="16"/>
            <polygon points="50,29 55,44 50,41 45,44"/>
            <polygon points="50,53 45,38 50,41 55,38" opacity="0.5"/>
          }
          @case ('headphones') {
            <path d="M34,47 V41 a16,16 0 0 1 32,0 V47"/>
            <rect x="29" y="45" width="7" height="13" rx="2.5"/>
            <rect x="64" y="45" width="7" height="13" rx="2.5"/>
          }
          @case ('quill-star') {
            <polygon points="50,26 54,38 67,38 56,46 60,58 50,50 40,58 44,46 33,38 46,38"/>
          }
          @case ('hourglass') {
            <path d="M36,27 H64"/><path d="M36,55 H64"/>
            <path d="M38,27 C38,39 50,40 50,40 C50,40 62,39 62,27"/>
            <path d="M38,55 C38,43 50,40 50,40 C50,40 62,43 62,55"/>
          }
          @case ('quill') {
            <path d="M62,27 C46,31 36,44 34,55 C45,53 58,43 62,27 Z"/>
            <line x1="40" y1="49" x2="52" y2="37"/>
          }
          @case ('mic') {
            <rect x="44" y="25" width="12" height="23" rx="6"/>
            <path d="M37,43 a13,13 0 0 0 26,0"/>
            <line x1="50" y1="56" x2="50" y2="61"/>
            <line x1="44" y1="61" x2="56" y2="61"/>
          }
          @case ('tag') {
            <path d="M30,41 L45,26 H62 V43 L47,58 Z"/>
            <circle cx="54" cy="34" r="2.5"/>
          }
          @case ('coin') {
            <circle cx="50" cy="41" r="16"/>
            <path d="M57,33 a10,10 0 1 0 0,16"/>
            <line x1="40" y1="38" x2="53" y2="38"/>
            <line x1="40" y1="44" x2="53" y2="44"/>
          }
          @case ('laurel') {
            <path d="M40,57 C30,50 30,35 41,28"/>
            <path d="M60,57 C70,50 70,35 59,28"/>
            <polygon points="50,33 52,40 59,40 53,44 55,51 50,47 45,51 47,44 41,40 48,40"/>
          }
          @case ('route') {
            <path d="M33,53 C46,53 40,33 52,33 C62,33 60,45 67,45" stroke-dasharray="2 4"/>
            <circle cx="33" cy="53" r="3"/>
            <circle cx="67" cy="45" r="3"/>
          }
          @case ('globe') {
            <circle cx="50" cy="41" r="16"/>
            <ellipse cx="50" cy="41" rx="6.5" ry="16"/>
            <line x1="34" y1="41" x2="66" y2="41"/>
            <line x1="37" y1="32" x2="63" y2="32"/>
            <line x1="37" y1="50" x2="63" y2="50"/>
          }
          @case ('speech') {
            <path d="M28,30 H50 V44 H38 L32,50 V44 H28 Z"/>
            <path d="M50,38 H72 V52 H58 L52,58 V52 H50"/>
          }
          @case ('book') {
            <path d="M30,32 C40,28 47,30 50,34 C53,30 60,28 70,32 V53 C60,49 53,51 50,55 C47,51 40,49 30,53 Z"/>
            <line x1="50" y1="34" x2="50" y2="55"/>
          }
          @default {
            <circle cx="50" cy="41" r="14"/>
          }
        }
      </g>

      <!-- threshold label -->
      <text class="badge-icon__label" x="50" [attr.y]="label().length > 3 ? 78 : 80"
        text-anchor="middle" [attr.font-size]="label().length > 3 ? 13 : 16">{{ label() }}</text>

      @if (!earned()) {
        <!-- small lock for locked badges -->
        <g class="badge-icon__lock" stroke-linecap="round" stroke-linejoin="round">
          <rect x="74" y="74" width="14" height="11" rx="2"/>
          <path d="M77,74 v-3 a4,4 0 0 1 8,0 v3"/>
        </g>
      }
    </svg>
  `,
  styles: [`
    :host { display: inline-block; line-height: 0; }

    .badge-icon { display: block; }
    .badge-icon__disc { transition: opacity 0.2s ease; }
    .badge-icon__ring { stroke: #1a1a1a; stroke-width: 1.5; }
    .badge-icon__art  { stroke: #1a1a1a; stroke-width: 2; }
    .badge-icon__art polygon,
    .badge-icon__art rect[fill]:not([fill="none"]) { fill: none; }
    .badge-icon__label {
      fill: #1a1a1a;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 700;
    }

    /* Earned: full-colour gradient disc, bold black ring + ink line-art */
    .badge-icon--earned .badge-icon__disc { opacity: 1; }
    .badge-icon--earned .badge-icon__ring { stroke-width: 2.5; }

    /* Locked: faint gradient, greyed ring/art/label + padlock */
    .badge-icon--locked .badge-icon__disc { opacity: 0.28; }
    .badge-icon--locked .badge-icon__ring { stroke: #c4c4c4; }
    .badge-icon--locked .badge-icon__art  { stroke: #bdbdbd; }
    .badge-icon--locked .badge-icon__label { fill: #bdbdbd; }
    .badge-icon__lock { stroke: #9e9e9e; stroke-width: 1.6; fill: #f4f4f4; }
  `],
})
export class BadgeIconComponent {
  readonly icon  = input.required<string>();
  readonly label = input('');
  readonly earned = input(false);
  readonly size  = input(88);
  readonly alt   = input('');
  /** Unique id for this badge's gradient + the two gradient stop colours. */
  readonly gradId = input('default');
  readonly from   = input('#eeeeee');
  readonly to     = input('#dddddd');
}

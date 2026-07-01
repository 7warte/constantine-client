import { Component, Input, forwardRef, ChangeDetectionStrategy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  templateUrl: './input.component.html',
  styleUrl: './input.component.scss',
})
export class InputComponent implements ControlValueAccessor {
  @Input() label       = '';
  @Input() type        = 'text';
  @Input() placeholder = '';
  @Input() hint        = '';
  @Input() errorMessage = '';
  @Input() invalid     = false;
  @Input() disabled    = false;
  @Input() multiline   = false;
  @Input() rows        = 3;

  value    = '';
  revealed = false;
  onChange = (_: string) => {};
  onTouched = () => {};

  get isPassword(): boolean { return this.type === 'password'; }
  get effectiveType(): string { return this.isPassword && this.revealed ? 'text' : this.type; }
  toggleReveal(): void { this.revealed = !this.revealed; }

  writeValue(val: string): void       { this.value = val ?? ''; }
  registerOnChange(fn: any): void     { this.onChange = fn; }
  registerOnTouched(fn: any): void    { this.onTouched = fn; }
  setDisabledState(disabled: boolean) { this.disabled = disabled; }

  onInput(event: Event): void {
    this.value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.onChange(this.value);
  }
}

import {
  ChangeDetectionStrategy, Component, Output, EventEmitter, Input,
  signal, computed, OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-audio-recorder',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audio-recorder.component.html',
  styleUrl: './audio-recorder.component.scss',
})
export class AudioRecorderComponent implements OnDestroy {
  /** Optional max duration in seconds. 0 = unlimited. */
  @Input() maxDuration = 0;

  /** Emits the recorded File when the user confirms. */
  @Output() recorded = new EventEmitter<File>();

  readonly state = signal<'idle' | 'recording' | 'preview'>('idle');
  readonly elapsed = signal(0);
  readonly error = signal<string | null>(null);

  readonly elapsedDisplay = computed(() => {
    const s = this.elapsed();
    const min = Math.floor(s / 60);
    const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  readonly maxDisplay = computed(() => {
    if (!this.maxDuration) return '';
    const min = Math.floor(this.maxDuration / 60);
    const sec = this.maxDuration % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  });

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private stream: MediaStream | null = null;

  recordedBlob: Blob | null = null;
  previewUrl: string | null = null;

  async startRecording(): Promise<void> {
    this.error.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      this.error.set('Microphone access denied. Check your browser permissions.');
      return;
    }

    this.chunks = [];
    this.elapsed.set(0);
    this.recordedBlob = null;
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }

    // Prefer webm (Chrome/Firefox), fall back to mp4 (Safari)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/mp4';

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      this.stopTimer();
      this.stopStream();

      const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
      this.recordedBlob = blob;
      this.previewUrl = URL.createObjectURL(blob);
      this.state.set('preview');
    };

    this.mediaRecorder.start(250); // collect data every 250ms
    this.state.set('recording');
    this.startTimer();
  }

  stopRecording(): void {
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  confirmRecording(): void {
    if (!this.recordedBlob) return;

    const ext = this.recordedBlob.type.includes('webm') ? 'webm' : 'm4a';
    const file = new File([this.recordedBlob], `recording.${ext}`, {
      type: this.recordedBlob.type,
    });

    this.recorded.emit(file);
    this.reset();
  }

  discardRecording(): void {
    this.reset();
  }

  private reset(): void {
    this.stopTimer();
    this.stopStream();
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
    this.recordedBlob = null;
    this.chunks = [];
    this.elapsed.set(0);
    this.state.set('idle');
  }

  private startTimer(): void {
    this.timer = setInterval(() => {
      this.elapsed.update(e => e + 1);
      if (this.maxDuration && this.elapsed() >= this.maxDuration) {
        this.stopRecording();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private stopStream(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  ngOnDestroy(): void {
    this.reset();
  }
}

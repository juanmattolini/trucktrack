import { provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { DemoComponent } from './app/demo/demo.component';

bootstrapApplication(DemoComponent, {
  providers: [provideZoneChangeDetection()]
}).catch((error: unknown) => console.error(error));

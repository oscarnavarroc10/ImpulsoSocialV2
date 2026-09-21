import { Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from './icon.component';

@Component({ selector: 'app-pagination', imports: [TranslocoPipe, IconComponent], template: `@if (pages() > 1) { <nav class="pagination" [attr.aria-label]="'common.pagination' | transloco"><button class="button button-secondary" type="button" [attr.aria-label]="'common.previous' | transloco" [disabled]="page() <= 1" (click)="changed.emit(page() - 1)"><app-icon name="arrowRight" /></button><span>{{ page() }} / {{ pages() }}</span><button class="button button-secondary" type="button" [attr.aria-label]="'common.next' | transloco" [disabled]="page() >= pages()" (click)="changed.emit(page() + 1)"><app-icon name="arrowRight" /></button></nav> }` })
export class PaginationComponent { readonly page = input(1); readonly pages = input(1); readonly changed = output<number>(); }

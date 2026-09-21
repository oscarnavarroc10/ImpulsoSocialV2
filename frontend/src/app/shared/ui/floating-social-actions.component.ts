import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantConfigService } from '../../core/config/tenant-config.service';
import { IconComponent } from './icon.component';

@Component({ selector: 'app-floating-social-actions', imports: [TranslocoPipe, IconComponent], template: `<div class="floating-social">@if (config.config()?.socialLinks?.whatsappUrl; as url) { <a [href]="url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'common.whatsapp' | transloco"><app-icon name="whatsapp" /></a> } @if (config.config()?.socialLinks?.tiktokUrl; as url) { <a [href]="url" target="_blank" rel="noopener noreferrer" [attr.aria-label]="'common.tiktok' | transloco"><app-icon name="tiktok" /></a> }</div>` })
export class FloatingSocialActionsComponent { protected readonly config = inject(TenantConfigService); }

import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TenantConfigService } from '../../core/config/tenant-config.service';

@Component({ selector: 'app-brand-logo', imports: [RouterLink], template: `<a class="brand" routerLink="/" [attr.aria-label]="config.config()?.brand?.name"><svg class="brand-mark" aria-hidden="true"><use href="/branding/impulsosocial/logo.svg#logo" /></svg><span>{{ config.config()?.brand?.shortName }}</span></a>` })
export class BrandLogoComponent { protected readonly config = inject(TenantConfigService); }

import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({ selector: 'app-not-found', imports: [RouterLink, TranslocoPipe], template: `<section class="page-intro shell not-found"><span class="hero-number">404</span><h1>{{ 'errors.notFoundTitle' | transloco }}</h1><p>{{ 'errors.notFoundText' | transloco }}</p><a class="button" routerLink="/">{{ 'common.backHome' | transloco }}</a></section>` })
export class NotFoundComponent {}

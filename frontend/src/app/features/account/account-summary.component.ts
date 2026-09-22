import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-account-summary',
  imports: [RouterLink, TranslocoPipe, IconComponent],
  templateUrl: './account-summary.component.html',
})
export class AccountSummaryComponent {
  protected readonly auth = inject(AuthService);
}
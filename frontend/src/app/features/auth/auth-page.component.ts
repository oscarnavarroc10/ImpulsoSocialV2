import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthOperationError, isSafeInternalReturnUrl } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { TenantConfigService } from '../../core/config/tenant-config.service';
import { BrandLogoComponent } from '../../shared/ui/brand-logo.component';
import { IconComponent } from '../../shared/ui/icon.component';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, BrandLogoComponent, IconComponent],
  templateUrl: './auth-page.component.html',
})
export class AuthPageComponent {
  private readonly formBuilder = inject(FormBuilder).nonNullable;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly tenant = inject(TenantConfigService);
  protected readonly showPassword = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly isRegister = this.route.snapshot.data['mode'] === 'register';

  protected readonly loginForm = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    rememberMe: [false],
  });

  protected readonly registerForm = this.formBuilder.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(100)]],
    confirmPassword: ['', [Validators.required]],
    terms: [false, [Validators.requiredTrue]],
  });

  constructor() {
    if (this.auth.isAuthenticated()) void this.router.navigateByUrl('/cuenta/nueva-orden');
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected async submitLogin(): Promise<void> {
    this.errorKey.set(null);
    if (this.loginForm.invalid || this.auth.isBusy()) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const value = this.loginForm.getRawValue();
    try {
      await this.auth.login(
        { email: value.email.trim(), password: value.password },
        value.rememberMe,
      );
      await this.router.navigateByUrl(this.returnUrl());
    } catch (error) {
      this.errorKey.set(this.errorTranslation(error));
    }
  }

  protected async submitRegister(): Promise<void> {
    this.errorKey.set(null);
    const value = this.registerForm.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.registerForm.controls.confirmPassword.setErrors({ mismatch: true });
    }
    if (this.registerForm.invalid || this.auth.isBusy()) {
      this.registerForm.markAllAsTouched();
      return;
    }
    try {
      await this.auth.register({
        nombre: value.nombre.trim(),
        email: value.email.trim(),
        password: value.password,
      });
      await this.router.navigateByUrl(this.returnUrl());
    } catch (error) {
      this.errorKey.set(this.errorTranslation(error));
    }
  }

  protected socialVisible(provider: 'google' | 'apple'): boolean {
    return this.tenant.config()?.socialAuth[provider].availability !== 'disabled';
  }

  protected emailError(form: 'login' | 'register'): string | null {
    const control =
      form === 'login' ? this.loginForm.controls.email : this.registerForm.controls.email;
    if (!control.touched || !control.errors) return null;
    return control.hasError('required')
      ? 'auth.validation.emailRequired'
      : 'auth.validation.emailInvalid';
  }

  protected passwordError(form: 'login' | 'register'): string | null {
    const control =
      form === 'login' ? this.loginForm.controls.password : this.registerForm.controls.password;
    if (!control.touched || !control.errors) return null;
    if (control.hasError('required')) return 'auth.validation.passwordRequired';
    return 'auth.validation.passwordLength';
  }

  protected nameError(): string | null {
    const control = this.registerForm.controls.nombre;
    if (!control.touched || !control.errors) return null;
    return control.hasError('required')
      ? 'auth.validation.nameRequired'
      : 'auth.validation.nameLength';
  }

  protected confirmationError(): string | null {
    const control = this.registerForm.controls.confirmPassword;
    if (!control.touched || !control.errors) return null;
    return control.hasError('required')
      ? 'auth.validation.confirmRequired'
      : 'auth.validation.passwordMismatch';
  }

  private returnUrl(): string {
    const value = this.route.snapshot.queryParamMap.get('returnUrl');
    return isSafeInternalReturnUrl(value) ? value : '/cuenta/nueva-orden';
  }

  private errorTranslation(error: unknown): string {
    const code = error instanceof AuthOperationError ? error.code : 'unknown';
    return `auth.errors.${code}`;
  }
}

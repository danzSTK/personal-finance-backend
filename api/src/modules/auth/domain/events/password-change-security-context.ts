export interface PasswordChangeSecurityContext {
  readonly ipAddress: string | null;
  readonly location: string | null;
  readonly browser: string | null;
  readonly operatingSystem: string | null;
  readonly device: string | null;
}

export interface User {
  id: string;
  displayName: string;
  email?: string;
  roles: string[];
  enabled: boolean;
  oauthProvider?: string; // 'google' etc
  oauthSubject?: string; // Provider-specific user ID
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

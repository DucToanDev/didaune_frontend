import { Injectable, signal } from '@angular/core';

export type AdminRole = 'moderator' | 'content_admin' | 'super_admin';
export type AdminCapability =
  | 'dashboard.view'
  | 'locations.manage'
  | 'reviews.manage'
  | 'users.manage'
  | 'partners.manage'
  | 'imports.manage'
  | 'taxonomy.manage'
  | 'collections.manage'
  | 'reports.view';

export interface AdminSession {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar: string;
}

const ADMIN_STORAGE_KEY = 'didaune_admin_session';

const MOCK_ADMINS: Array<AdminSession & { password: string }> = [
  {
    id: 'admin-1',
    name: 'Toan Admin',
    email: 'admin@didaune.vn',
    role: 'super_admin',
    avatar: 'https://ui-avatars.com/api/?name=Toan+Admin&background=0f172a&color=fff&size=128',
    password: 'admin123',
  },
  {
    id: 'content-1',
    name: 'Khanh Content',
    email: 'content@didaune.vn',
    role: 'content_admin',
    avatar: 'https://ui-avatars.com/api/?name=Khanh+Content&background=ea580c&color=fff&size=128',
    password: 'content123',
  },
  {
    id: 'mod-1',
    name: 'Lan Moderator',
    email: 'moderator@didaune.vn',
    role: 'moderator',
    avatar: 'https://ui-avatars.com/api/?name=Lan+Moderator&background=2563eb&color=fff&size=128',
    password: 'mod123',
  },
];

const ROLE_CAPABILITIES: Record<AdminRole, AdminCapability[]> = {
  moderator: ['dashboard.view', 'reviews.manage'],
  content_admin: [
    'dashboard.view',
    'locations.manage',
    'reviews.manage',
    'partners.manage',
    'taxonomy.manage',
    'collections.manage',
    'reports.view',
  ],
  super_admin: [
    'dashboard.view',
    'locations.manage',
    'reviews.manage',
    'users.manage',
    'partners.manage',
    'imports.manage',
    'taxonomy.manage',
    'collections.manage',
    'reports.view',
  ],
};

@Injectable({
  providedIn: 'root',
})
export class AdminAuthService {
  adminSession = signal<AdminSession | null>(this.readSession());

  isAuthenticated(): boolean {
    return this.adminSession() !== null;
  }

  login(email: string, password: string): { ok: true } | { ok: false; message: string } {
    const admin = MOCK_ADMINS.find(
      (candidate) =>
        candidate.email.toLowerCase() === email.trim().toLowerCase() &&
        candidate.password === password
    );

    if (!admin) {
      return {
        ok: false,
        message: 'Tai khoan admin khong hop le. Thu lai email/mat khau mock.',
      };
    }

    const { password: _password, ...session } = admin;
    this.adminSession.set(session);
    this.writeSession(session);
    return { ok: true };
  }

  logout() {
    this.adminSession.set(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    }
  }

  hasRole(roles: AdminRole[]): boolean {
    const session = this.adminSession();
    return !!session && roles.includes(session.role);
  }

  hasCapability(capability: AdminCapability): boolean {
    const session = this.adminSession();
    return !!session && ROLE_CAPABILITIES[session.role].includes(capability);
  }

  private readSession(): AdminSession | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const value = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as AdminSession;
    } catch {
      return null;
    }
  }

  private writeSession(session: AdminSession) {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(session));
  }
}

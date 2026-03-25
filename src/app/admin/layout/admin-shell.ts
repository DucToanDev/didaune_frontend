import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { ShellNav } from '../shared/shell-nav/shell-nav';
import { AdminAuthService } from '../../core/services/admin/admin-auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, ShellNav],
  templateUrl: './admin-shell.html',
  styleUrl: './admin-shell.css',
})
export class AdminShell {
  adminAuth = inject(AdminAuthService);

  logout() {
    this.adminAuth.logout();
  }
}

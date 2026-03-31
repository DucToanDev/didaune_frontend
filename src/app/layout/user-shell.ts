import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Aside } from '../shared/ui/aside/aside';
import { Header } from '../shared/ui/header/header';
import { Tabbar } from '../shared/ui/tabbar/tabbar';
import { CommonModule } from '@angular/common';
import { DataService } from '../core/services/data.service';
import { AuthRequiredAlert } from '../shared/ui/auth-required-alert/auth-required-alert';

@Component({
  selector: 'app-user-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, Header, Aside, Tabbar, AuthRequiredAlert],
  templateUrl: './user-shell.html',
})
export class UserShell {
  constructor(public dataService: DataService) {}

  closeMobileSidebar() {
    this.dataService.mobileSidebarOpen.set(false);
  }
}

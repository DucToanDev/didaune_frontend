import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Aside } from '../shared/ui/aside/aside';
import { Header } from '../shared/ui/header/header';
import { Tabbar } from '../shared/ui/tabbar/tabbar';

@Component({
  selector: 'app-user-shell',
  standalone: true,
  imports: [RouterOutlet, Header, Aside, Tabbar],
  templateUrl: './user-shell.html',
})
export class UserShell {}

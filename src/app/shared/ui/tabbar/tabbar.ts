import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-tabbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './tabbar.html',
  styleUrl: './tabbar.css',
})
export class Tabbar {}

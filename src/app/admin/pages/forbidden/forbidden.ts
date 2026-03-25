import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-forbidden',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './forbidden.html',
})
export class AdminForbidden {}

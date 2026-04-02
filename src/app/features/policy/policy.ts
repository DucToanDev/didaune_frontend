import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

@Component({
  selector: 'app-policy',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './policy.html',
  styleUrl: './policy.css',
})
export class Policy implements OnInit {
  constructor(private seo: SeoService) {}

  ngOnInit() {
    this.seo.setPage({
      title: 'Chính sách',
      description: 'Chính sách và điều khoản sử dụng DiDauNe.',
      path: '/policy',
    });
  }
}

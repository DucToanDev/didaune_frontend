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

  downloadPolicyPdf() {
    if (typeof window === 'undefined') {
      return;
    }

    window.print();
  }

  scrollToSection(sectionId: string) {
    if (typeof document === 'undefined') {
      return;
    }

    const section = document.getElementById(sectionId);

    if (!section) {
      return;
    }

    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }
}

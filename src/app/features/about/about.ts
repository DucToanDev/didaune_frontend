import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { SeoService } from '../../core/services/seo.service';

interface TeamLink {
  icon: string;
  href: string;
}

interface TeamMember {
  name: string;
  role: string;
  quote: string;
  accentBgClass: string;
  accentTextClass: string;
  accentHoverClass: string;
  avatarUrl: string;
  links: TeamLink[];
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About implements OnInit {
  teamMembers: TeamMember[] = [
    {
      name: 'Phan Đức Toàn',
      role: 'Project Leader & Fullstack Developer',
      quote: 'Kỹ thuật là nền tảng, sáng tạo là chìa khóa.',
      accentBgClass: 'bg-orange-500',
      accentTextClass: 'text-orange-500',
      accentHoverClass: 'hover:text-orange-500 hover:bg-orange-50',
      avatarUrl: '/assets/images/phanductoan.jpg',
      links: [
        { icon: 'fa-brands fa-github', href: 'https://github.com/DucToanDev' },
        {
          icon: 'fa-brands fa-linkedin-in',
          href: 'https://www.linkedin.com/in/ductoandev/',
        },
        { icon: 'fa-solid fa-globe', href: 'https://phanductoan.id.vn' },
      ],
    },
    {
      name: 'Trần Thiện Vũ',
      role: 'Frontend Developer',
      quote: 'Biến những bản thiết kế trở nên sống động trên web.',
      accentBgClass: 'bg-blue-500',
      accentTextClass: 'text-blue-500',
      accentHoverClass: 'hover:text-blue-500 hover:bg-blue-50',
      avatarUrl: '/assets/images/tranthienvu.jpg',
      links: [
        { icon: 'fa-brands fa-github', href: '#' },
        { icon: 'fa-brands fa-behance', href: '#' },
      ],
    },
    {
      name: 'Nguyễn N. Viễn Đông',
      role: 'Designer & Maketing',
      quote: 'Trai nghiem nguoi dung la trai tim cua ung dung.',
      accentBgClass: 'bg-green-500',
      accentTextClass: 'text-green-500',
      accentHoverClass: 'hover:text-green-500 hover:bg-green-50',
      avatarUrl: '/assets/images/viendong.jpg',
      links: [
        { icon: 'fa-brands fa-figma', href: '#' },
        { icon: 'fa-brands fa-dribbble', href: '#' },
      ],
    },
    {
      name: 'Ngô Gia Bảo',
      role: 'Frontend Developer',
      quote: 'Trai nghiem nguoi dung la trai tim cua ung dung.',
      accentBgClass: 'bg-green-500',
      accentTextClass: 'text-green-500',
      accentHoverClass: 'hover:text-green-500 hover:bg-green-50',
      avatarUrl: '/assets/images/ngogiabao.png',
      links: [
        { icon: 'fa-brands fa-figma', href: '#' },
        { icon: 'fa-brands fa-dribbble', href: '#' },
      ],
    },
    {
      name: 'Nguyễn Hoàng Tuấn',
      role: 'Frontend Developer',
      quote: 'Trai nghiem nguoi dung la trai tim cua ung dung.',
      accentBgClass: 'bg-green-500',
      accentTextClass: 'text-green-500',
      accentHoverClass: 'hover:text-green-500 hover:bg-green-50',
      avatarUrl: 'https://ui-avatars.com/api/?name=Member+3&background=random',
      links: [
        { icon: 'fa-brands fa-figma', href: '#' },
        { icon: 'fa-brands fa-dribbble', href: '#' },
      ],
    },
    {
      name: 'Tằng Tấn Phúc',
      role: 'Frontend Developer',
      quote: 'Trai nghiem nguoi dung la trai tim cua ung dung.',
      accentBgClass: 'bg-green-500',
      accentTextClass: 'text-green-500',
      accentHoverClass: 'hover:text-green-500 hover:bg-green-50',
      avatarUrl: 'https://ui-avatars.com/api/?name=Member+3&background=random',
      links: [
        { icon: 'fa-brands fa-figma', href: '#' },
        { icon: 'fa-brands fa-dribbble', href: '#' },
      ],
    },
  ];

  constructor(private seo: SeoService) {}

  ngOnInit() {
    this.seo.setPage({
      title: 'Đội ngũ',
      description: 'Gap go doi ngu sang lap va phat trien DiDauNe.',
      path: '/about',
    });
  }
}

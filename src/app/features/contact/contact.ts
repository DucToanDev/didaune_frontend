import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

// PrimeNG
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { CardModule } from 'primeng/card';
import { MessageService } from 'primeng/api';
import { SeoService } from '../../core/services/seo.service';

interface TopicOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    TextareaModule,
    ButtonModule,
    SelectModule,
    ToastModule,
    CardModule,
  ],
  providers: [MessageService],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class Contact implements OnInit {
  private fb = new FormBuilder();

  submitting = signal(false);
  submitted = signal(false);

  topics: TopicOption[] = [
    { label: 'Góp ý về địa điểm', value: 'place_feedback' },
    { label: 'Báo lỗi kỹ thuật', value: 'bug_report' },
    { label: 'Đăng ký đối tác', value: 'partner' },
    { label: 'Hợp tác quảng cáo', value: 'advertising' },
    { label: 'Khác', value: 'other' },
  ];

  form: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    topic: [null, Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor(private messageService: MessageService, private seo: SeoService) {}

  ngOnInit() {
    this.seo.setPage({
      title: 'Liên hệ',
      description: 'Gửi thông tin liên hệ hoặc phản hồi cho DiDauNe.',
      path: '/contact',
    });
  }

  get name() { return this.form.get('name')!; }
  get email() { return this.form.get('email')!; }
  get topic() { return this.form.get('topic')!; }
  get message() { return this.form.get('message')!; }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);

    // Simulate API call
    setTimeout(() => {
      this.submitting.set(false);
      this.submitted.set(true);
      this.messageService.add({
        severity: 'success',
        summary: 'Gửi thành công!',
        detail: 'Chúng tôi sẽ phản hồi bạn trong vòng 24 giờ.',
        life: 4000,
      });
      this.form.reset();
    }, 1200);
  }

  resetForm() {
    this.submitted.set(false);
    this.form.reset();
  }
}

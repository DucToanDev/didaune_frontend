import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
    customClass: {
      popup: 'didaune-toast',
      title: 'didaune-toast-title',
    },
  });

  success(title: string) {
    return this.show('success', title);
  }

  error(title: string) {
    return this.show('error', title);
  }

  warning(title: string) {
    return this.show('warning', title);
  }

  info(title: string) {
    return this.show('info', title);
  }

  confirm(options: {
    title: string;
    text?: string;
    confirmButtonText?: string;
    cancelButtonText?: string;
    icon?: SweetAlertIcon;
  }) {
    return Swal.fire({
      title: options.title,
      text: options.text,
      icon: options.icon ?? 'warning',
      showCancelButton: true,
      confirmButtonText: options.confirmButtonText ?? 'Xác nhận',
      cancelButtonText: options.cancelButtonText ?? 'Hủy',
      reverseButtons: true,
      confirmButtonColor: '#ea580c',
      cancelButtonColor: '#94a3b8',
    });
  }

  private show(icon: SweetAlertIcon, title: string) {
    return this.toast.fire({ icon, title });
  }
}

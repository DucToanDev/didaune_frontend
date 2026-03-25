import { Amenity, Category } from '../models/app.models';

export const CATEGORY_CONFIG: Category[] = [
  { id: 'cafe', name: 'Cà phê', icon: 'fa-mug-hot', color: 'text-primary' },
  { id: 'hotel', name: 'Hotel', icon: 'fa-bed', color: 'text-sky-600' },
  { id: 'homestay', name: 'Homestay', icon: 'fa-house', color: 'text-emerald-600' },
  { id: 'restaurant', name: 'Nhà hàng', icon: 'fa-utensils', color: 'text-rose-600' },
  { id: 'travel', name: 'Du lịch', icon: 'fa-map-location-dot', color: 'text-amber-600' },
  { id: 'date', name: 'Hẹn hò', icon: 'fa-heart', color: 'text-rose-500' },
  { id: 'group', name: 'Tụ tập', icon: 'fa-users', color: 'text-blue-500' },
  { id: 'work', name: 'Làm việc', icon: 'fa-laptop-code', color: 'text-emerald-500' },
  { id: 'photo', name: 'Sống ảo', icon: 'fa-camera', color: 'text-violet-500' },
];

export const AMENITY_CONFIG: Amenity[] = [
  { id: 'late', name: 'Mở tối', icon: 'fa-clock' },
  { id: 'parking', name: 'Dễ gửi xe', icon: 'fa-car' },
  { id: 'quiet', name: 'Yên tĩnh', icon: 'fa-volume-low' },
  { id: 'wifi', name: 'Wifi tốt', icon: 'fa-wifi' },
  { id: 'music', name: 'Có nhạc', icon: 'fa-music' },
  { id: 'outdoor', name: 'Cho ngồi ngoài trời', icon: 'fa-tree' },
];

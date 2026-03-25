import { Amenity, Category } from '../models/app.models';

export const CATEGORY_CONFIG: Category[] = [
  { id: 'cafe', name: 'Ca phe', icon: 'fa-mug-hot', color: 'text-primary' },
  { id: 'date', name: 'Hen ho', icon: 'fa-heart', color: 'text-rose-500' },
  { id: 'group', name: 'Tu tap', icon: 'fa-users', color: 'text-blue-500' },
  { id: 'work', name: 'Lam viec', icon: 'fa-laptop-code', color: 'text-emerald-500' },
  { id: 'photo', name: 'Song ao', icon: 'fa-camera', color: 'text-violet-500' },
];

export const AMENITY_CONFIG: Amenity[] = [
  { id: 'late', name: 'Mo toi', icon: 'fa-clock' },
  { id: 'parking', name: 'De gui xe', icon: 'fa-car' },
  { id: 'quiet', name: 'Yen tinh', icon: 'fa-volume-low' },
  { id: 'wifi', name: 'Wifi tot', icon: 'fa-wifi' },
  { id: 'music', name: 'Co nhac', icon: 'fa-music' },
  { id: 'outdoor', name: 'Cho ngoi ngoai troi', icon: 'fa-tree' },
];

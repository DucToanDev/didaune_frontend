export interface ProvinceMapping {
  id: string;
  provinceCode: number;
  sortOrder: number;
}

export const PROVINCE_MAPPINGS: ProvinceMapping[] = [
  { id: 'hcm', provinceCode: 79, sortOrder: 1 },
  { id: 'hn', provinceCode: 1, sortOrder: 2 },
  { id: 'dl', provinceCode: 66, sortOrder: 3 },
];

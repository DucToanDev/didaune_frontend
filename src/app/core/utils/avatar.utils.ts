export function buildUiAvatarUrl(
  name: string,
  background = 'f97316',
  color = 'ffffff',
  size?: number,
): string {
  const encodedName = encodeURIComponent(name.trim() || 'Khach');
  const sizeQuery = size ? `&size=${size}` : '';

  return `https://ui-avatars.com/api/?name=${encodedName}&background=${background}&color=${color}${sizeQuery}`;
}

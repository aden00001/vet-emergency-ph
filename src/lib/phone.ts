export function normalizePhilippinePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (digits.startsWith("63")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+63${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `+63${digits}`;
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function telHref(phone: string): string {
  return `tel:${normalizePhilippinePhone(phone)}`;
}

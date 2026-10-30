export function normalizeWhatsapp(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return null;
}

export function formatWhatsapp(e164: string): string {
  const local = e164.startsWith("55") ? e164.slice(2) : e164;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return e164;
}

export function whatsappLink(e164: string, message: string): string {
  return `https://wa.me/${e164}?text=${encodeURIComponent(message)}`;
}

export function normalizeName(input: string): string | null {
  const name = input.trim().replace(/\s+/g, " ");
  if (!/^[\p{L}][\p{L}\s'.-]{1,79}$/u.test(name)) return null;
  return name;
}

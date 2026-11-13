export async function compressImage(fileOrBlob, maxSide = 900, quality = 0.8) {
  const bitmap = await createImageBitmap(fileOrBlob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", quality));
}

export const fmtDT = (iso) =>
  iso ? new Date(iso).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-";

export function timeLeft(iso) {
  const ms = new Date(iso) - new Date();
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  return h >= 1 ? `${h}h ${m % 60}m left` : `${m}m left`;
}

export const dirLink = (lat, lng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

export const fmtPhone = (p) => (p ? "+" + p : "");

export const DONOR_TYPES = [
  ["individual", "Individual"], ["restaurant", "Restaurant"], ["hotel", "Hotel"],
  ["hostel", "Hostel / Mess"], ["canteen", "Canteen"], ["event", "Event / Wedding / Function"],
];

export function badgeFor(n) {
  if (n >= 30) return { name: "Champion", icon: "🏆", next: null };
  if (n >= 15) return { name: "Hunger Fighter", icon: "🥇", next: 30 };
  if (n >= 5) return { name: "Food Hero", icon: "🥈", next: 15 };
  if (n >= 1) return { name: "First Giver", icon: "🥉", next: 5 };
  return { name: "New Donor", icon: "🌱", next: 1 };
}

export const toISO = (localValue) => new Date(localValue).toISOString();

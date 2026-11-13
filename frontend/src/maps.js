let promise;
export const hasMapsKey = !!import.meta.env.VITE_GOOGLE_MAPS_KEY;

export function loadMaps() {
  if (!hasMapsKey) return Promise.reject(new Error("no key"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}`;
      s.async = true;
      s.onload = () => resolve(window.google.maps);
      s.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(s);
    });
  }
  return promise;
}

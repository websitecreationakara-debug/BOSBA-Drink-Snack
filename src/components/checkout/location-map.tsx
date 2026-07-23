// Client-only Leaflet map with a draggable pin, used at checkout so a customer
// can set their delivery location visually instead of typing an address blind.
// Leaflet touches `window`/`document` on init, so the map itself is only ever
// built inside useEffect (never at module scope / during SSR).
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, Marker } from "leaflet";

type Coords = { lat: number; lng: number };

// Phnom Penh center — used when the customer hasn't pinned a location yet.
const DEFAULT_CENTER: [number, number] = [11.5564, 104.9282];

// touch-action:none lets the pin be dragged freely in any direction — it
// opts out of the container's pan-y rule below (see elRef's className).
const PIN_ICON_HTML = `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:#16a34a;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);touch-action:none"></div>`;

export function LocationMap({
  coords,
  onChange,
  readOnly = false,
}: {
  coords: Coords | null;
  onChange?: (coords: Coords) => void;
  // Shows a fixed pin (e.g. the store's own location) with no drag/click/zoom
  // interaction — just a visual reference, not an input.
  readOnly?: boolean;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;

      const start: [number, number] = coords ? [coords.lat, coords.lng] : DEFAULT_CENTER;
      const map = L.map(elRef.current, {
        dragging: !readOnly,
        // Always off: a mouse-wheel/trackpad scroll over an in-page map should
        // scroll the page, not zoom the map. Zooming stays available via the
        // +/- buttons (zoomControl).
        scrollWheelZoom: false,
        zoomControl: !readOnly,
        doubleClickZoom: !readOnly,
        touchZoom: !readOnly,
      }).setView(start, coords ? 16 : 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({
        className: "",
        html: PIN_ICON_HTML,
        iconSize: [26, 26],
        iconAnchor: [13, 26],
      });
      const marker = L.marker(start, { icon, draggable: !readOnly }).addTo(map);
      if (!readOnly) {
        marker.on("dragend", () => {
          const pos = marker.getLatLng();
          onChangeRef.current?.({ lat: pos.lat, lng: pos.lng });
        });
        map.on("click", (e) => {
          marker.setLatLng(e.latlng);
          onChangeRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
        });
      }

      mapRef.current = map;
      markerRef.current = marker;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Mounted once; external coord changes (GPS button, saved address) are
    // synced via the effect below instead of re-creating the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!coords || !mapRef.current || !markerRef.current) return;
    const pos: [number, number] = [coords.lat, coords.lng];
    markerRef.current.setLatLng(pos);
    mapRef.current.setView(pos, Math.max(mapRef.current.getZoom(), 15));
  }, [coords]);

  return (
    <div
      ref={elRef}
      // A vertical swipe over the map scrolls the page like the rest of the
      // checkout form; only horizontal/pinch gestures pan or zoom the map
      // itself. Set inline (not a Tailwind class) because leaflet.css loads
      // after Tailwind's utilities and its own `.leaflet-container { touch-action:
      // none }` would otherwise win the cascade and trap the page scroll.
      style={{ touchAction: "pan-y" }}
      // `isolate` walls off Leaflet's internal z-indexes (panes 200-400,
      // controls 1000) in their own stacking context; without it they beat the
      // sticky header (z-40) and the map paints over the nav when scrolling.
      className="isolate h-56 sm:h-64 w-full rounded-xl overflow-hidden border"
      role={readOnly ? "img" : "application"}
      aria-label={
        readOnly ? "Store location on the map" : "Drag the pin to set your delivery location"
      }
    />
  );
}

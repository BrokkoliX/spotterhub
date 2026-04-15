'use client';

import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { type LatLngExpression, type LeafletMouseEvent } from 'leaflet';
import { useEffect, useState } from 'react';
import L from 'leaflet';

import 'leaflet/dist/leaflet.css';
import styles from './MapPicker.module.css';

// Fix default marker icon for Next.js / webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MapPickerProps {
  position: { lat: number; lng: number } | null;
  onSelect: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: LatLngExpression = [33.9425, -118.4081]; // KLAX
const DEFAULT_ZOOM = 10;

function MapClickHandler({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function MapPicker({ position, onSelect }: MapPickerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration requires setState in effect
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={styles.placeholder}>
        <span>Loading map…</span>
      </div>
    );
  }

  const center: LatLngExpression = position
    ? [position.lat, position.lng]
    : DEFAULT_CENTER;

  return (
    <MapContainer
      center={center}
      zoom={position ? 14 : DEFAULT_ZOOM}
      className={styles.map}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onSelect={onSelect} />
      {position && (
        <Marker
          position={[position.lat, position.lng]}
          draggable={true}
          eventHandlers={{
            dragend(e) {
              const marker = e.target;
              const latlng = marker.getLatLng();
              onSelect(latlng.lat, latlng.lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}

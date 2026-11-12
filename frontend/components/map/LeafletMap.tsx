'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { LatLng } from '@/lib/types';

export interface LeafletMapProps {
  value: LatLng;
  onChange?: (value: LatLng) => void;
  height?: number;
}

function ClickToPin({ onChange }: { onChange?: (v: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onChange?.({ lat: Math.round(e.latlng.lat * 1e5) / 1e5, lng: Math.round(e.latlng.lng * 1e5) / 1e5 });
    },
  });
  return null;
}

function FollowValue({ value }: { value: LatLng }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([value.lat, value.lng]);
  }, [map, value.lat, value.lng]);
  return null;
}

/** OpenStreetMap tiles via Leaflet (TRD section 3: no per-request cost). */
export default function LeafletMap({ value, onChange, height = 220 }: LeafletMapProps) {
  return (
    <MapContainer center={[value.lat, value.lng]} zoom={9} style={{ height }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker center={[value.lat, value.lng]} radius={10} pathOptions={{ color: '#205d2e', fillColor: '#389148', fillOpacity: 0.8 }} />
      <ClickToPin onChange={onChange} />
      <FollowValue value={value} />
    </MapContainer>
  );
}

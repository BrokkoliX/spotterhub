'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from 'urql';

import { GET_AIRPORTS } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AirportData {
  id: string;
  icaoCode: string;
  iataCode?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
  photoCount: number;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ─── Component ──────────────────────────────────────────────────────────────

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [airportsResult] = useQuery({ query: GET_AIRPORTS });

  // ─── Initialize Map ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.your_mapbox_token') return;
    if (!mapContainerRef.current || mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [0, 30],
      zoom: 2,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setMapReady(true);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Add Airport Markers ────────────────────────────────────────────────

  const addMarkers = useCallback(
    (airports: AirportData[]) => {
      const map = mapRef.current;
      if (!map) return;

      for (const airport of airports) {
        const code = airport.iataCode ?? airport.icaoCode;
        const photoLabel =
          airport.photoCount === 1
            ? '1 photo'
            : `${airport.photoCount} photos`;

        const el = document.createElement('div');
        el.style.cssText =
          'width:28px;height:28px;border-radius:50%;background:#3b82f6;border:2px solid #fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
        el.textContent = '✈';
        el.title = `${airport.name} (${code})`;

        const popup = new mapboxgl.Popup({ offset: 18, maxWidth: '260px' }).setHTML(
          `<div style="font-family:system-ui,sans-serif;">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${airport.name}</div>
            <div style="font-size:12px;color:#888;margin-bottom:4px;">${code}${airport.city ? ` · ${airport.city}` : ''}${airport.country ? `, ${airport.country}` : ''}</div>
            <div style="font-size:12px;color:#aaa;margin-bottom:8px;">📷 ${photoLabel}</div>
            <a href="/airports/${airport.icaoCode}" style="display:inline-block;padding:5px 12px;background:#3b82f6;color:#fff;border-radius:4px;text-decoration:none;font-size:12px;font-weight:500;">View Airport</a>
          </div>`,
        );

        new mapboxgl.Marker(el)
          .setLngLat([airport.longitude, airport.latitude])
          .setPopup(popup)
          .addTo(map);
      }
    },
    [],
  );

  useEffect(() => {
    if (mapReady && airportsResult.data?.airports) {
      addMarkers(airportsResult.data.airports);
    }
  }, [mapReady, airportsResult.data, addMarkers]);

  // ─── No Token Guard ────────────────────────────────────────────────────

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN === 'pk.your_mapbox_token') {
    return (
      <div className={styles.page}>
        <div className={styles.noToken}>
          <div style={{ fontSize: '2.5rem' }}>🗺️</div>
          <h2>Mapbox Token Required</h2>
          <p>
            Set your token in <code>.env</code>:
          </p>
          <code>NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_real_token</code>
          <p>
            Get a free token at{' '}
            <a
              href="https://account.mapbox.com/access-tokens/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3b82f6' }}
            >
              mapbox.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.mapContainer}>
        {airportsResult.fetching && (
          <div className={styles.loading}>Loading airports…</div>
        )}
        <div ref={mapContainerRef} className={styles.map} />
      </div>
    </div>
  );
}

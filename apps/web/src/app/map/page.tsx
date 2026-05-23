'use client';

import 'mapbox-gl/dist/mapbox-gl.css';

import mapboxgl from 'mapbox-gl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from 'urql';
import Supercluster from 'supercluster';

import { AIRPORTS_IN_BOUNDS, PHOTOS_IN_BOUNDS } from '@/lib/queries';

import styles from './page.module.css';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AirportMarkerData {
  id: string;
  icaoCode: string;
  iataCode?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  latitude: number;
  longitude: number;
}

interface PhotoMarkerData {
  id: string;
  latitude: number;
  longitude: number;
  thumbnailUrl?: string | null;
  caption?: string | null;
}

type PhotoPointProps = {
  photoId: string;
  thumbnailUrl?: string | null;
  caption?: string | null;
};

type AirportPointProps = {
  airportId: string;
  icaoCode: string;
  iataCode?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// ─── Component ──────────────────────────────────────────────────────────────

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const photoClusterRef = useRef<Supercluster<PhotoPointProps> | null>(null);
  const airportClusterRef = useRef<Supercluster<AirportPointProps> | null>(null);
  const photoMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const airportMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [bounds, setBounds] = useState<{
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  } | null>(null);

  const [airportsResult] = useQuery({
    query: AIRPORTS_IN_BOUNDS,
    variables: bounds ? { ...bounds, first: 2000 } : undefined,
    pause: !bounds,
  });

  const [photosResult] = useQuery({
    query: PHOTOS_IN_BOUNDS,
    variables: bounds ? { ...bounds, first: 200 } : undefined,
    pause: !bounds,
  });

  const updateBounds = (map: mapboxgl.Map) => {
    const b = map.getBounds();
    if (!b) return;
    setBounds({
      swLat: b.getSouthWest().lat,
      swLng: b.getSouthWest().lng,
      neLat: b.getNorthEast().lat,
      neLng: b.getNorthEast().lng,
    });
  };

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
      updateBounds(map);
    });

    map.on('moveend', () => {
      updateBounds(map);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ─── Airport Markers with Clustering ───────────────────────────────────

  const renderAirportMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !airportClusterRef.current) return;

    // Clear existing airport markers
    for (const m of airportMarkersRef.current) {
      m.remove();
    }
    airportMarkersRef.current = [];

    const zoom = Math.floor(map.getZoom());
    const b = map.getBounds();
    if (!b) return;
    const clusters = airportClusterRef.current.getClusters(
      [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      zoom,
    );

    for (const feature of clusters) {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties as Record<string, unknown>;

      if (props.cluster) {
        const count = props.point_count as number;
        const el = document.createElement('div');
        const size = count < 10 ? 32 : count < 100 ? 40 : 48;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:#3b82f6;border:2px solid #fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:${size < 40 ? 12 : 14}px;color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
        el.textContent = String(count);
        el.title = `${count} airports`;

        el.addEventListener('click', () => {
          const clusterId = props.cluster_id;
          const expansionZoom = airportClusterRef.current!.getClusterExpansionZoom(
            clusterId as number,
          );
          map.flyTo({ center: [lng, lat], zoom: expansionZoom });
        });

        const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
        airportMarkersRef.current.push(marker);
      } else {
        // Single airport marker
        const code = (props.iataCode as string | null | undefined) ?? (props.icaoCode as string);
        const el = document.createElement('div');
        el.style.cssText =
          'width:28px;height:28px;border-radius:50%;background:#3b82f6;border:2px solid #fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
        el.textContent = '✈';
        el.title = `${props.name as string} (${code})`;

        const popup = new mapboxgl.Popup({ offset: 18, maxWidth: '260px' }).setHTML(
          `<div style="font-family:system-ui,sans-serif;">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${props.name as string}</div>
            <div style="font-size:12px;color:#888;margin-bottom:4px;">${code}${props.city ? ` · ${props.city as string}` : ''}${props.country ? `, ${props.country as string}` : ''}</div>
            <a href="/airports/${props.icaoCode as string}" style="display:inline-block;padding:5px 12px;background:#3b82f6;color:#fff;border-radius:4px;text-decoration:none;font-size:12px;font-weight:500;">View Airport</a>
          </div>`,
        );

        const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).setPopup(popup).addTo(map);
        airportMarkersRef.current.push(marker);
      }
    }
  }, []);

  // Load airports into Supercluster when query results change
  useEffect(() => {
    const airports: AirportMarkerData[] = airportsResult.data?.airportsInBounds ?? [];
    if (airports.length === 0) {
      for (const m of airportMarkersRef.current) m.remove();
      airportMarkersRef.current = [];
      airportClusterRef.current = null;
      return;
    }

    const points: Supercluster.PointFeature<AirportPointProps>[] = airports.map((a) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [a.longitude, a.latitude] },
      properties: {
        airportId: a.id,
        icaoCode: a.icaoCode,
        iataCode: a.iataCode,
        name: a.name,
        city: a.city,
        country: a.country,
      },
    }));

    const cluster = new Supercluster<AirportPointProps>({
      radius: 50,
      maxZoom: 14,
    });
    cluster.load(points);
    airportClusterRef.current = cluster;

    renderAirportMarkers();
  }, [airportsResult.data, renderAirportMarkers]);

  // ─── Photo Markers with Clustering ─────────────────────────────────────

  const renderPhotoMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || !photoClusterRef.current) return;

    // Clear existing photo markers
    for (const m of photoMarkersRef.current) {
      m.remove();
    }
    photoMarkersRef.current = [];

    const zoom = Math.floor(map.getZoom());
    const b = map.getBounds();
    if (!b) return;
    const clusters = photoClusterRef.current.getClusters(
      [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
      zoom,
    );

    for (const feature of clusters) {
      const [lng, lat] = feature.geometry.coordinates;
      const props = feature.properties as Record<string, unknown>;

      if (props.cluster) {
        const count = props.point_count as number;
        const el = document.createElement('div');
        const size = count < 10 ? 32 : count < 50 ? 40 : 48;
        el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:#f59e0b;border:2px solid #fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:${size < 40 ? 12 : 14}px;color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.3);`;
        el.textContent = String(count);
        el.title = `${count} photos`;

        el.addEventListener('click', () => {
          const clusterId = props.cluster_id;
          const expansionZoom = photoClusterRef.current!.getClusterExpansionZoom(
            clusterId as number,
          );
          map.flyTo({ center: [lng, lat], zoom: expansionZoom });
        });

        const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).addTo(map);
        photoMarkersRef.current.push(marker);
      } else {
        // Single photo marker
        const el = document.createElement('div');
        if (props.thumbnailUrl) {
          el.style.cssText =
            'width:36px;height:36px;border-radius:4px;border:2px solid #f59e0b;cursor:pointer;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
          const img = document.createElement('img');
          img.src = props.thumbnailUrl as string;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          img.alt = (props.caption as string) ?? 'Photo';
          el.appendChild(img);
        } else {
          el.style.cssText =
            'width:28px;height:28px;border-radius:50%;background:#f59e0b;border:2px solid #fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);';
          el.textContent = '📷';
        }

        const popup = new mapboxgl.Popup({ offset: 20, maxWidth: '220px' }).setHTML(
          `<div style="font-family:system-ui,sans-serif;">
            ${props.thumbnailUrl ? `<img src="${props.thumbnailUrl as string}" style="width:100%;border-radius:4px;margin-bottom:6px;" alt="" />` : ''}
            ${props.caption ? `<div style="font-size:12px;margin-bottom:6px;">${props.caption as string}</div>` : ''}
            <a href="/photos/${props.photoId as string}" style="display:inline-block;padding:5px 12px;background:#f59e0b;color:#fff;border-radius:4px;text-decoration:none;font-size:12px;font-weight:500;">View Photo</a>
          </div>`,
        );

        const marker = new mapboxgl.Marker(el).setLngLat([lng, lat]).setPopup(popup).addTo(map);
        photoMarkersRef.current.push(marker);
      }
    }
  }, []);

  // Load photo data into Supercluster when photos change
  useEffect(() => {
    const photos: PhotoMarkerData[] = photosResult.data?.photosInBounds ?? [];
    if (photos.length === 0) {
      for (const m of photoMarkersRef.current) m.remove();
      photoMarkersRef.current = [];
      photoClusterRef.current = null;
      return;
    }

    const points: Supercluster.PointFeature<PhotoPointProps>[] = photos.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
      properties: {
        photoId: p.id,
        thumbnailUrl: p.thumbnailUrl,
        caption: p.caption,
      },
    }));

    const cluster = new Supercluster<PhotoPointProps>({
      radius: 60,
      maxZoom: 18,
    });
    cluster.load(points);
    photoClusterRef.current = cluster;

    renderPhotoMarkers();
  }, [photosResult.data, renderPhotoMarkers]);

  // Re-render markers on zoom (cluster expansion)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onZoomEnd = () => {
      renderPhotoMarkers();
      renderAirportMarkers();
    };
    map.on('zoomend', onZoomEnd);

    return () => {
      map.off('zoomend', onZoomEnd);
    };
  }, [renderPhotoMarkers, renderAirportMarkers]);

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

  // Surface loading state. mapReady is intentionally referenced in JSX so it
  // is not flagged as unused — it gates the loading indicator below.
  return (
    <div className={styles.page}>
      <div className={styles.mapContainer}>
        {(!mapReady || airportsResult.fetching || photosResult.fetching) && (
          <div className={styles.loading}>{!mapReady ? 'Loading map…' : 'Loading markers…'}</div>
        )}
        <div ref={mapContainerRef} className={styles.map} />
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface GoogleRouteMapProps {
  centerLat: number;
  centerLng: number;
  originLabel?: string;
  destLat?: number | null;
  destLng?: number | null;
  destLabel?: string;
  driverLat?: number | null;
  driverLng?: number | null;
  polyline?: LatLngPoint[];
  returnPolyline?: LatLngPoint[];
  heightClassName?: string;
}

interface GoogleMapsGlobal {
  maps?: {
    Map: new (
      el: HTMLElement,
      opts: Record<string, unknown>
    ) => {
      fitBounds: (bounds: unknown, padding?: number) => void;
    };
    Marker: new (opts: Record<string, unknown>) => unknown;
    Polyline: new (opts: Record<string, unknown>) => unknown;
    LatLngBounds: new () => {
      extend: (pt: { lat: number; lng: number }) => void;
    };
  };
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleMapsScript(apiKey: string): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  const win = window as unknown as { google?: GoogleMapsGlobal };
  if (win.google?.maps) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });
  return googleScriptPromise;
}

export function GoogleRouteMap({
  centerLat,
  centerLng,
  originLabel = 'Pickup',
  destLat,
  destLng,
  destLabel = 'Destination',
  driverLat,
  driverLng,
  polyline = [],
  returnPolyline = [],
  heightClassName = 'h-56',
}: GoogleRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  const mapError = !apiKey
    ? 'Google Maps API key not configured in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.'
    : loadError;

  useEffect(() => {
    let active = true;
    if (!apiKey) {
      return;
    }

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (!active || !containerRef.current) return;
        const win = window as unknown as { google?: GoogleMapsGlobal };
        const gmaps = win.google?.maps;
        if (!gmaps) return;

        const map = new gmaps.Map(containerRef.current, {
          center: { lat: centerLat, lng: centerLng },
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        });

        const bounds = new gmaps.LatLngBounds();
        bounds.extend({ lat: centerLat, lng: centerLng });

        new gmaps.Marker({
          position: { lat: centerLat, lng: centerLng },
          map,
          title: originLabel,
          label: 'P',
        });

        if (destLat != null && destLng != null) {
          bounds.extend({ lat: destLat, lng: destLng });
          new gmaps.Marker({
            position: { lat: destLat, lng: destLng },
            map,
            title: destLabel,
            label: 'D',
          });
        }

        if (driverLat != null && driverLng != null) {
          bounds.extend({ lat: driverLat, lng: driverLng });
          new gmaps.Marker({
            position: { lat: driverLat, lng: driverLng },
            map,
            title: 'Assigned Driver Live GPS',
            label: 'R',
          });
        }

        if (polyline.length >= 2) {
          for (const p of polyline) bounds.extend(p);
          new gmaps.Polyline({
            path: polyline,
            strokeColor: '#2563EB',
            strokeOpacity: 0.9,
            strokeWeight: 5,
            map,
          });
        } else if (destLat != null && destLng != null) {
          new gmaps.Polyline({
            path: [
              { lat: centerLat, lng: centerLng },
              { lat: destLat, lng: destLng },
            ],
            strokeColor: '#2563EB',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map,
          });
        }

        if (returnPolyline.length >= 2) {
          for (const p of returnPolyline) bounds.extend(p);
          new gmaps.Polyline({
            path: returnPolyline,
            strokeColor: '#16A34A',
            strokeOpacity: 0.85,
            strokeWeight: 4,
            map,
          });
        }

        if ((destLat != null && destLng != null) || (driverLat != null && driverLng != null)) {
          map.fitBounds(bounds, 40);
        }
        setMapReady(true);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'Google Maps unavailable');
      });

    return () => {
      active = false;
    };
  }, [
    apiKey,
    centerLat,
    centerLng,
    originLabel,
    destLat,
    destLng,
    destLabel,
    driverLat,
    driverLng,
    polyline,
    returnPolyline,
  ]);

  const googleExternalUrl =
    destLat != null && destLng != null
      ? `https://www.google.com/maps/dir/?api=1&origin=${centerLat},${centerLng}&destination=${destLat},${destLng}`
      : `https://www.google.com/maps/search/?api=1&query=${centerLat},${centerLng}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2 text-[11px]">
        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
          <MapPin className="h-3.5 w-3.5 text-blue-600" />
          Google Maps Platform · {centerLat.toFixed(4)}, {centerLng.toFixed(4)}
        </span>
        <a
          href={googleExternalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
        >
          Open in Google Maps <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      {mapError ? (
        <div className="flex items-center justify-between p-3 text-xs text-slate-500">
          <span>{mapError}</span>
        </div>
      ) : (
        <div className={`relative w-full ${heightClassName}`}>
          <div ref={containerRef} className="h-full w-full" />
          {!mapReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100/80 text-xs text-slate-500">
              Loading Google Maps...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

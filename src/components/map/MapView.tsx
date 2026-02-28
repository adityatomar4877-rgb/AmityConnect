"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const iconUrl = "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png";
const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png";

const customIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

const userLocationIcon = L.divIcon({
    className: "",
    html: `
        <div style="position:relative;width:36px;height:36px;">
            <div style="position:absolute;inset:0;background:rgba(59,130,246,0.25);border-radius:50%;animation:acPulse 2s infinite;"></div>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(59,130,246,0.7);"></div>
        </div>
        <style>@keyframes acPulse{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.7);opacity:0.15}}</style>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
});

// Flies to new center when props change
function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.flyTo(center, zoom, { animate: true, duration: 1.5 });
    }, [center[0], center[1], zoom]);
    return null;
}

// Fires onLocationSelect when user clicks/taps the map
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return null;
}

interface MarkerData {
    id: string;
    position: [number, number];
    title: string;
    description?: string;
    isUser?: boolean;
}

interface MapViewProps {
    center?: [number, number];
    zoom?: number;
    markers?: MarkerData[];
    onLocationSelect?: (lat: number, lng: number) => void;
}

const MapView = ({
    center = [26.2307, 78.1969],
    zoom = 16,
    markers = [],
    onLocationSelect,
}: MapViewProps) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return (
            <div className="h-[400px] w-full bg-gray-100 animate-pulse flex items-center justify-center text-gray-500">
                Loading Map...
            </div>
        );
    }

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={false}
            className="h-[400px] w-full rounded-lg z-0"
        >
            <MapRecenter center={center} zoom={zoom} />
            {onLocationSelect && <MapClickHandler onLocationSelect={onLocationSelect} />}

            <TileLayer
                attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            />

            {markers.map((marker) =>
                marker.isUser ? (
                    <Marker key={marker.id} position={marker.position} icon={userLocationIcon}>
                        <Popup>
                            <div style={{ textAlign: "center" }}>
                                <p style={{ fontWeight: "bold", color: "#3b82f6" }}>📍 You are here</p>
                                <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                                    {marker.position[0].toFixed(5)}, {marker.position[1].toFixed(5)}
                                </p>
                            </div>
                        </Popup>
                    </Marker>
                ) : (
                    <Marker key={marker.id} position={marker.position} icon={customIcon}>
                        <Popup>
                            <h3 style={{ fontWeight: "bold" }}>{marker.title}</h3>
                            {marker.description && <p>{marker.description}</p>}
                        </Popup>
                    </Marker>
                )
            )}
        </MapContainer>
    );
};

export default MapView;
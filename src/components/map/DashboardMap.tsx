"use client";

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false });

interface DashboardMapProps {
    userLocation?: { lat: number; lng: number } | null;
}

export default function DashboardMap({ userLocation }: DashboardMapProps) {
    const center: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : [26.2307, 78.1969]; // Default: Amity University Madhya Pradesh Gwalior

    const userMarker = userLocation
        ? [{
            id: "current-user",
            position: [userLocation.lat, userLocation.lng] as [number, number],
            title: "📍 You are here",
            description: "Your current location",
            isUser: true,
        }]
        : [];

    return <MapView center={center} zoom={userLocation ? 17 : 16} markers={userMarker} />;
}
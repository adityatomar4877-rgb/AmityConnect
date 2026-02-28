"use client";

import { useEffect, useState } from "react";
import { collection, query, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Ride } from "@/types";
import RideCard from "@/components/rides/RideCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Plus, Car, Users, MapPin, Globe, History } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Hardcoded sample rides for demo
const SAMPLE_RIDES: Ride[] = [
    {
        id: "demo-ride-1",
        hostId: "demo-user-1",
        hostName: "Rahul Sharma",
        type: "OFFER",
        origin: "Amity Gwalior Campus",
        destination: "Gwalior Bus Stand",
        departureTime: Timestamp.fromDate(new Date(Date.now() + 3600000)),
        seatsAvailable: 3,
        status: "OPEN",
        createdAt: Timestamp.fromDate(new Date()),
    },
    {
        id: "demo-ride-2",
        hostId: "demo-user-2",
        hostName: "Priya Patel",
        type: "REQUEST",
        origin: "Gwalior Junction",
        destination: "Amity Gwalior Campus",
        departureTime: Timestamp.fromDate(new Date(Date.now() + 7200000)),
        seatsAvailable: 1,
        status: "OPEN",
        createdAt: Timestamp.fromDate(new Date()),
    },
    {
        id: "demo-ride-3",
        hostId: "demo-user-3",
        hostName: "Amit Kumar",
        type: "OFFER",
        origin: "Amity Gwalior Campus",
        destination: "Gwalior Airport",
        departureTime: Timestamp.fromDate(new Date(Date.now() + 14400000)),
        seatsAvailable: 2,
        status: "OPEN",
        createdAt: Timestamp.fromDate(new Date()),
    },
    {
        id: "demo-ride-4",
        hostId: "demo-user-4",
        hostName: "Sneha Desai",
        type: "OFFER",
        origin: "City Center Gwalior",
        destination: "Amity Gwalior Campus",
        departureTime: Timestamp.fromDate(new Date(Date.now() + 18000000)),
        seatsAvailable: 4,
        status: "OPEN",
        createdAt: Timestamp.fromDate(new Date()),
    },
    {
        id: "demo-ride-5",
        hostId: "demo-user-5",
        hostName: "Vikram Singh",
        type: "REQUEST",
        origin: "Amity Gwalior Campus",
        destination: "Gwalior Fort",
        departureTime: Timestamp.fromDate(new Date(Date.now() + 21600000)),
        seatsAvailable: 2,
        status: "OPEN",
        createdAt: Timestamp.fromDate(new Date()),
    },
];

// Haversine distance in km between two lat/lng points
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const NEAR_ME_RADIUS_KM = 10; // Show rides within 10 km

export default function RideBoardPage() {
    const [rides, setRides] = useState<Ride[]>(SAMPLE_RIDES);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<"ALL" | "OFFER" | "REQUEST">("ALL");
    const [locationMode, setLocationMode] = useState<"ALL" | "NEAR">("ALL");
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [locationError, setLocationError] = useState("");

    // Load user location from sessionStorage
    useEffect(() => {
        const saved = sessionStorage.getItem("userLocation");
        if (saved) {
            setUserLocation(JSON.parse(saved));
        }
    }, []);

    useEffect(() => {
        const ridesRef = collection(db, "rides");
        const q = query(ridesRef);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const ridesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Ride[];

            const openRides = ridesData
                .filter(ride => ride.status === "OPEN")
                .sort((a, b) => {
                    const aTime = typeof a.departureTime === "string"
                        ? new Date(a.departureTime).getTime()
                        : (a.departureTime as any)?.toDate?.()?.getTime() || 0;
                    const bTime = typeof b.departureTime === "string"
                        ? new Date(b.departureTime).getTime()
                        : (b.departureTime as any)?.toDate?.()?.getTime() || 0;
                    return aTime - bTime;
                });

            if (openRides.length > 0) {
                setRides(openRides);
            }
            setLoading(false);
        }, () => {
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleNearMe = () => {
        if (locationMode === "NEAR") {
            setLocationMode("ALL");
            return;
        }

        if (userLocation) {
            setLocationMode("NEAR");
            return;
        }

        // Request location if not available
        if (!navigator.geolocation) {
            setLocationError("Geolocation not supported by your browser.");
            return;
        }
        setLocationError("");
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLocation(loc);
                sessionStorage.setItem("userLocation", JSON.stringify(loc));
                setLocationMode("NEAR");
            },
            () => {
                setLocationError("Could not get your location. Please enable location access.");
            }
        );
    };

    // Filter by type
    let filteredRides = rides.filter(ride =>
        filter === "ALL" ? true : ride.type === filter
    );

    // Filter by proximity if Near Me mode
    if (locationMode === "NEAR" && userLocation) {
        filteredRides = filteredRides
            .filter(ride => {
                const geo = ride.originGeo as any;
                if (!geo) return true; // keep rides without geo (sample data)
                const lat = geo.latitude ?? geo._lat;
                const lng = geo.longitude ?? geo._long;
                if (!lat || !lng) return true;
                return getDistanceKm(userLocation.lat, userLocation.lng, lat, lng) <= NEAR_ME_RADIUS_KM;
            })
            .sort((a, b) => {
                const geoA = a.originGeo as any;
                const geoB = b.originGeo as any;
                if (!geoA || !geoB) return 0;
                const distA = getDistanceKm(userLocation.lat, userLocation.lng, geoA.latitude ?? geoA._lat, geoA.longitude ?? geoA._long);
                const distB = getDistanceKm(userLocation.lat, userLocation.lng, geoB.latitude ?? geoB._lat, geoB.longitude ?? geoB._long);
                return distA - distB;
            });
    }

    const offerCount = rides.filter(r => r.type === "OFFER").length;
    const requestCount = rides.filter(r => r.type === "REQUEST").length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Ride Board</h1>
                    <p className="text-muted-foreground">Find a ride or offer one to your peers.</p>
                </div>
                <div className="flex gap-2">
                    <Link href="/rides/history">
                        <Button variant="outline" className="gap-2">
                            <History size={16} /> History
                        </Button>
                    </Link>
                    <Link href="/rides/create">
                        <Button className="gap-2">
                            <Plus size={16} /> Post a Ride
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/20">
                            <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{offerCount}</p>
                            <p className="text-sm text-muted-foreground">Rides Offered</p>
                        </div>
                    </div>
                </div>
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{requestCount}</p>
                            <p className="text-sm text-muted-foreground">Rides Requested</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Near Me / All Rides Toggle */}
            <div className="flex items-center gap-3 flex-wrap">
                <button
                    onClick={() => { setLocationMode("ALL"); setLocationError(""); }}
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium border-2 transition-all ${locationMode === "ALL"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                        }`}
                >
                    <Globe className="h-4 w-4" />
                    All Rides
                </button>
                <button
                    onClick={handleNearMe}
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium border-2 transition-all ${locationMode === "NEAR"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-background text-muted-foreground border-border hover:border-blue-400"
                        }`}
                >
                    <MapPin className="h-4 w-4" />
                    Near Me
                    {locationMode === "NEAR" && userLocation && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs">
                            {NEAR_ME_RADIUS_KM} km
                        </span>
                    )}
                </button>

                {locationError && (
                    <p className="text-sm text-red-500">{locationError}</p>
                )}

                {locationMode === "NEAR" && (
                    <p className="text-xs text-muted-foreground ml-1">
                        Showing rides within {NEAR_ME_RADIUS_KM} km of your location, sorted by distance
                    </p>
                )}
            </div>

            <Tabs defaultValue="ALL" onValueChange={(val) => setFilter(val as any)}>
                <TabsList>
                    <TabsTrigger value="ALL">All Rides</TabsTrigger>
                    <TabsTrigger value="OFFER">Offering</TabsTrigger>
                    <TabsTrigger value="REQUEST">Requesting</TabsTrigger>
                </TabsList>

                <TabsContent value="ALL" className="mt-6">
                    <RideGrid rides={filteredRides} loading={loading} nearMe={locationMode === "NEAR"} />
                </TabsContent>
                <TabsContent value="OFFER" className="mt-6">
                    <RideGrid rides={filteredRides} loading={loading} nearMe={locationMode === "NEAR"} />
                </TabsContent>
                <TabsContent value="REQUEST" className="mt-6">
                    <RideGrid rides={filteredRides} loading={loading} nearMe={locationMode === "NEAR"} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function RideGrid({ rides, loading, nearMe }: { rides: Ride[], loading: boolean, nearMe: boolean }) {
    if (loading) {
        return (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="space-y-3">
                        <Skeleton className="h-[150px] w-full rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-[250px]" />
                            <Skeleton className="h-4 w-[200px]" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (rides.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
                    {nearMe ? (
                        <MapPin className="h-12 w-12 text-muted-foreground" />
                    ) : (
                        <Car className="h-12 w-12 text-muted-foreground" />
                    )}
                </div>
                <h3 className="text-xl font-bold">
                    {nearMe ? "No rides near you" : "No rides available"}
                </h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                    {nearMe
                        ? "No rides found within 10 km of your location. Try switching to All Rides."
                        : "Be the first to post a ride or request one!"}
                </p>
                <Link href="/rides/create" className="mt-4">
                    <Button>Post a Ride</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rides.map(ride => (
                <RideCard key={ride.id} ride={ride} />
            ))}
        </div>
    );
}
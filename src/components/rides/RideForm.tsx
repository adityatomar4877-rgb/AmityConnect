"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addDoc, collection, serverTimestamp, GeoPoint, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, MapPin, RefreshCw, Calendar } from "lucide-react";
import dynamic from "next/dynamic";
import { toast } from "sonner";

const MapView = dynamic(() => import('@/components/map/MapView'), { ssr: false });

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const DAY_LABELS: Record<string, string> = {
    MON: 'M', TUE: 'T', WED: 'W', THU: 'Th', FRI: 'F', SAT: 'Sa', SUN: 'Su'
};

export default function RideForm() {
    const { user } = useAuth();
    const router = useRouter();

    const [type, setType] = useState<'OFFER' | 'REQUEST'>('OFFER');
    const [origin, setOrigin] = useState("");
    const [destination, setDestination] = useState("");
    const [seats, setSeats] = useState(3);
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [isRecurring, setIsRecurring] = useState(false);
    const [selectedDays, setSelectedDays] = useState<string[]>([]);

    const [originGeo, setOriginGeo] = useState<[number, number] | null>(null);
    const [destGeo, setDestGeo] = useState<[number, number] | null>(null);
    const [selectingMode, setSelectingMode] = useState<'NONE' | 'ORIGIN' | 'DESTINATION'>('NONE');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const toggleDay = (day: string) => {
        setSelectedDays(prev =>
            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
        );
    };

    const handleMapClick = (lat: number, lng: number) => {
        if (selectingMode === 'ORIGIN') {
            setOriginGeo([lat, lng]);
            setOrigin(`Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            setSelectingMode('NONE');
        } else if (selectingMode === 'DESTINATION') {
            setDestGeo([lat, lng]);
            setDestination(`Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
            setSelectingMode('NONE');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setError("");

        try {
            if (!originGeo || !destGeo) throw new Error("Please select both Origin and Destination on the map.");

            if (isRecurring) {
                if (selectedDays.length === 0) throw new Error("Please select at least one day for recurring rides.");
                if (!time) throw new Error("Please set a departure time.");

                await addDoc(collection(db, "recurringRides"), {
                    hostId: user.uid,
                    hostName: user.displayName || "Anonymous",
                    hostPhoto: user.photoURL || "",
                    type,
                    origin,
                    destination,
                    originGeo: new GeoPoint(originGeo[0], originGeo[1]),
                    destinationGeo: new GeoPoint(destGeo[0], destGeo[1]),
                    departureTime: time,
                    days: selectedDays,
                    seatsAvailable: type === 'OFFER' ? Number(seats) : null,
                    status: 'ACTIVE',
                    subscriberIds: [],
                    createdAt: serverTimestamp(),
                });
                toast.success("Recurring ride posted!");
            } else {
                if (!date) throw new Error("Please select a date.");
                const departureDateTime = new Date(`${date}T${time}`);

                await addDoc(collection(db, "rides"), {
                    hostId: user.uid,
                    hostName: user.displayName || "Anonymous",
                    hostPhoto: user.photoURL || "",
                    type,
                    origin,
                    destination,
                    originGeo: new GeoPoint(originGeo[0], originGeo[1]),
                    destinationGeo: new GeoPoint(destGeo[0], destGeo[1]),
                    departureTime: Timestamp.fromDate(departureDateTime),
                    seatsAvailable: type === 'OFFER' ? Number(seats) : null,
                    status: 'OPEN',
                    passengerIds: [],
                    createdAt: serverTimestamp(),
                });
                toast.success("Ride posted!");
            }

            router.push("/rides");
        } catch (err: any) {
            setError(err.message || "Failed to create ride");
        } finally {
            setLoading(false);
        }
    };

    const markers = [
        ...(originGeo ? [{ id: 'origin', position: originGeo as [number, number], title: 'Origin' }] : []),
        ...(destGeo ? [{ id: 'destination', position: destGeo as [number, number], title: 'Destination' }] : [])
    ];

    return (
        <div className="grid md:grid-cols-2 gap-6">
            <Card>
                <CardContent className="pt-6 space-y-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Type */}
                        <div className="space-y-2">
                            <Label>I want to</Label>
                            <Select value={type} onValueChange={(v: any) => setType(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="OFFER">Offer a Ride</SelectItem>
                                    <SelectItem value="REQUEST">Request a Ride</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Recurring toggle */}
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                            <button
                                type="button"
                                onClick={() => setIsRecurring(!isRecurring)}
                                className={`relative w-10 h-6 rounded-full transition-colors ${isRecurring ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                            >
                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isRecurring ? 'left-5' : 'left-1'}`} />
                            </button>
                            <div>
                                <p className="text-sm font-medium flex items-center gap-1.5">
                                    <RefreshCw size={14} /> Recurring Ride
                                </p>
                                <p className="text-xs text-muted-foreground">Repeat every week on selected days</p>
                            </div>
                        </div>

                        {/* Origin */}
                        <div className="space-y-2">
                            <Label>Origin</Label>
                            <div className="flex gap-2">
                                <Input value={origin} onChange={e => setOrigin(e.target.value)} placeholder="Start location..." required />
                                <Button type="button" variant={selectingMode === 'ORIGIN' ? "destructive" : "outline"}
                                    onClick={() => setSelectingMode(selectingMode === 'ORIGIN' ? 'NONE' : 'ORIGIN')}>
                                    <MapPin size={18} />
                                </Button>
                            </div>
                        </div>

                        {/* Destination */}
                        <div className="space-y-2">
                            <Label>Destination</Label>
                            <div className="flex gap-2">
                                <Input value={destination} onChange={e => setDestination(e.target.value)} placeholder="End location..." required />
                                <Button type="button" variant={selectingMode === 'DESTINATION' ? "destructive" : "outline"}
                                    onClick={() => setSelectingMode(selectingMode === 'DESTINATION' ? 'NONE' : 'DESTINATION')}>
                                    <MapPin size={18} />
                                </Button>
                            </div>
                        </div>

                        {/* Date/Time */}
                        {isRecurring ? (
                            <div className="space-y-3">
                                <Label>Days of week</Label>
                                <div className="flex gap-2 flex-wrap">
                                    {DAYS.map(day => (
                                        <button key={day} type="button"
                                            onClick={() => toggleDay(day)}
                                            className={`w-9 h-9 rounded-full text-xs font-semibold border-2 transition-all ${selectedDays.includes(day)
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'border-muted-foreground/30 text-muted-foreground hover:border-primary'}`}
                                        >
                                            {DAY_LABELS[day]}
                                        </button>
                                    ))}
                                </div>
                                <div className="space-y-2">
                                    <Label>Departure Time</Label>
                                    <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Date</Label>
                                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Time</Label>
                                    <Input type="time" value={time} onChange={e => setTime(e.target.value)} required />
                                </div>
                            </div>
                        )}

                        {/* Seats */}
                        {type === 'OFFER' && (
                            <div className="space-y-2">
                                <Label>Available Seats</Label>
                                <Input type="number" min={1} max={6} value={seats} onChange={e => setSeats(Number(e.target.value))} required />
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                                <AlertCircle size={16} /><span>{error}</span>
                            </div>
                        )}

                        <div className="pt-4 pb-20 md:pb-0">
                            <Button type="submit"
                                className="fixed bottom-0 left-0 right-0 w-full rounded-none h-16 text-lg z-50 md:static md:w-full md:h-10 md:rounded-md md:text-sm md:z-auto"
                                disabled={loading}>
                                {loading ? "Posting..." : isRecurring ? "Post Recurring Ride" : "Post Ride"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <div className="space-y-2">
                <Label>Select Location on Map</Label>
                <div className={`border-2 rounded-lg overflow-hidden ${selectingMode !== 'NONE' ? 'border-blue-500 ring-2 ring-blue-200 cursor-crosshair' : 'border-transparent'}`}>
                    <MapView onLocationSelect={handleMapClick} markers={markers} />
                </div>
                {selectingMode !== 'NONE' && (
                    <p className="text-sm text-blue-600 animate-pulse">Tap on the map to set {selectingMode.toLowerCase()}</p>
                )}
            </div>
        </div>
    );
}
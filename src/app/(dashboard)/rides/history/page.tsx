"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { Ride, RideRequest } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Car, Users, MapPin, Calendar, ArrowLeft,
    Loader2, History, CheckCircle, XCircle, Clock, Route, Star
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import RateRideModal from "@/components/rides/RateRideModal";

function parseDate(date: any): Date | null {
    if (!date) return null;
    if (typeof date === "string") return new Date(date);
    if (typeof date.toDate === "function") return date.toDate();
    return null;
}

const STATUS_STYLES: Record<string, string> = {
    OPEN: "bg-green-500/10 text-green-600 border-green-200",
    FILLED: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    EN_ROUTE: "bg-blue-500/10 text-blue-600 border-blue-200",
    COMPLETED: "bg-gray-400/10 text-gray-500 border-gray-200",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
    OPEN: <Clock size={12} />,
    FILLED: <Users size={12} />,
    EN_ROUTE: <Route size={12} />,
    COMPLETED: <CheckCircle size={12} />,
    CANCELLED: <XCircle size={12} />,
};

interface RideWithRequest extends Ride {
    myRequest?: RideRequest;
    _role?: "host" | "passenger";
}

interface RatingTarget {
    rideId: string;
    ratedUserId: string;
    ratedUserName: string;
    ratedUserPhoto?: string;
    role: "host" | "passenger";
}

export default function RideHistoryPage() {
    const { user } = useAuth();
    const [hostedRides, setHostedRides] = useState<RideWithRequest[]>([]);
    const [joinedRides, setJoinedRides] = useState<RideWithRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
    const [ratedRideIds, setRatedRideIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (!user) return;

        const fetchHistory = async () => {
            setLoading(true);
            try {
                // Rides hosted
                const hostedSnap = await getDocs(query(collection(db, "rides"), where("hostId", "==", user.uid)));
                const hosted = hostedSnap.docs
                    .map(d => ({ ...d.data() as Ride, id: d.id, _role: "host" as const }))
                    .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0));
                setHostedRides(hosted);

                // Confirmed requests (rides joined)
                const reqSnap = await getDocs(query(
                    collection(db, "rideRequests"),
                    where("passengerId", "==", user.uid),
                    where("status", "==", "CONFIRMED")
                ));
                const requests = reqSnap.docs.map(d => ({ id: d.id, ...d.data() } as RideRequest));

                const joined: RideWithRequest[] = [];
                await Promise.all(requests.map(async (req) => {
                    try {
                        const rideDoc = await getDoc(doc(db, "rides", req.rideId));
                        if (rideDoc.exists()) {
                            joined.push({ ...rideDoc.data() as Ride, id: rideDoc.id, myRequest: req, _role: "passenger" });
                        }
                    } catch { }
                }));
                joined.sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0));
                setJoinedRides(joined);

                // Already rated rides
                const ratedSnap = await getDocs(query(collection(db, "rideRatings"), where("raterId", "==", user.uid)));
                setRatedRideIds(new Set(ratedSnap.docs.map(d => d.data().rideId)));

            } catch (err) { console.error(err); }
            finally { setLoading(false); }
        };

        fetchHistory();
    }, [user]);

    const handleRateDone = () => {
        if (ratingTarget) {
            setRatedRideIds(prev => new Set([...prev, ratingTarget.rideId]));
        }
        setRatingTarget(null);
    };

    const stats = {
        total: hostedRides.length + joinedRides.length,
        completed: [...hostedRides, ...joinedRides].filter(r => r.status === "COMPLETED").length,
        offered: hostedRides.length,
        joined: joinedRides.length,
    };

    const allRides = [...hostedRides, ...joinedRides]
        .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0));

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/rides"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><History size={22} /> Ride History</h1>
                    <p className="text-sm text-muted-foreground">All your past and active rides</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                    { label: "Total Rides", value: stats.total, color: "text-primary", bg: "bg-primary/5 border-primary/10" },
                    { label: "Completed", value: stats.completed, color: "text-green-600", bg: "bg-green-500/5 border-green-200/50" },
                    { label: "Offered", value: stats.offered, color: "text-blue-600", bg: "bg-blue-500/5 border-blue-200/50" },
                    { label: "Joined", value: stats.joined, color: "text-purple-600", bg: "bg-purple-500/5 border-purple-200/50" },
                ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-4 ${s.bg}`}>
                        <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            <Tabs defaultValue="all">
                <TabsList className="w-full">
                    <TabsTrigger value="all" className="flex-1">All ({stats.total})</TabsTrigger>
                    <TabsTrigger value="offered" className="flex-1"><Car size={14} className="mr-1.5" />Offered ({stats.offered})</TabsTrigger>
                    <TabsTrigger value="joined" className="flex-1"><Users size={14} className="mr-1.5" />Joined ({stats.joined})</TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-4 space-y-3">
                    {allRides.map(ride => (
                        <RideHistoryCard key={ride.id + ride._role} ride={ride} role={ride._role!}
                            alreadyRated={ratedRideIds.has(ride.id)} onRate={setRatingTarget} />
                    ))}
                    {stats.total === 0 && <EmptyState />}
                </TabsContent>

                <TabsContent value="offered" className="mt-4 space-y-3">
                    {hostedRides.map(ride => (
                        <RideHistoryCard key={ride.id} ride={ride} role="host"
                            alreadyRated={ratedRideIds.has(ride.id)} onRate={setRatingTarget} />
                    ))}
                    {hostedRides.length === 0 && <EmptyState message="You haven't offered any rides yet." />}
                </TabsContent>

                <TabsContent value="joined" className="mt-4 space-y-3">
                    {joinedRides.map(ride => (
                        <RideHistoryCard key={ride.id} ride={ride} role="passenger"
                            alreadyRated={ratedRideIds.has(ride.id)} onRate={setRatingTarget} />
                    ))}
                    {joinedRides.length === 0 && <EmptyState message="You haven't joined any rides yet." />}
                </TabsContent>
            </Tabs>

            {/* Rating Modal */}
            {ratingTarget && (
                <RateRideModal
                    {...ratingTarget}
                    onClose={() => setRatingTarget(null)}
                    onDone={handleRateDone}
                />
            )}
        </div>
    );
}

function RideHistoryCard({ ride, role, alreadyRated, onRate }: {
    ride: RideWithRequest;
    role: "host" | "passenger";
    alreadyRated: boolean;
    onRate: (target: any) => void;
}) {
    const originName = typeof ride.origin === "string" ? ride.origin : ride.origin?.name || "Unknown";
    const destName = typeof ride.destination === "string" ? ride.destination : ride.destination?.name || "Unknown";
    const departureDate = parseDate(ride.departureTime);
    const seats = ride.seatsAvailable ?? ride.availableSeats ?? 0;
    const isCompleted = ride.status === "COMPLETED";

    // For host: rate the first passenger. For passenger: rate the host.
    const canRate = isCompleted && !alreadyRated;

    const handleRateClick = () => {
        if (role === "passenger") {
            // Passenger rates the host
            onRate({
                rideId: ride.id,
                ratedUserId: ride.hostId,
                ratedUserName: ride.hostName || ride.userName || "Driver",
                ratedUserPhoto: ride.hostPhoto,
                role: "host",
            });
        }
        // Host rating flow handled from ride detail page
    };

    return (
        <Card className="border overflow-hidden hover:shadow-md transition-shadow">
            <div className={`h-1 ${role === "host" ? "bg-gradient-to-r from-blue-500 to-cyan-400" : "bg-gradient-to-r from-purple-500 to-pink-400"}`} />
            <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <div className="w-px h-3 bg-muted-foreground/20" />
                                <MapPin size={8} className="text-red-500" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-medium truncate">{originName}</p>
                                <p className="text-muted-foreground truncate text-xs">{destName}</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <Calendar size={11} />
                                {departureDate ? format(departureDate, "MMM d, yyyy · h:mm a") : "TBD"}
                            </span>
                            {role === "host" && seats > 0 && (
                                <span className="flex items-center gap-1"><Users size={11} /> {seats} seats</span>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs gap-1 ${STATUS_STYLES[ride.status] || ""}`}>
                            {STATUS_ICONS[ride.status]} {ride.status}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${role === "host" ? "bg-blue-500/5 text-blue-600 border-blue-200" : "bg-purple-500/5 text-purple-600 border-purple-200"}`}>
                            {role === "host" ? "🚗 Host" : "👤 Passenger"}
                        </Badge>

                        {/* Action buttons */}
                        <div className="flex gap-1.5 mt-1">
                            {role === "host" && (
                                <Link href={`/rides/${ride.id}`}>
                                    <Button variant="ghost" size="sm" className="text-xs h-7 px-2">Manage →</Button>
                                </Link>
                            )}
                            {canRate && role === "passenger" && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 px-2 gap-1 text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                                    onClick={handleRateClick}
                                >
                                    <Star size={12} className="fill-yellow-400 text-yellow-400" /> Rate
                                </Button>
                            )}
                            {alreadyRated && isCompleted && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CheckCircle size={11} className="text-green-500" /> Rated
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function EmptyState({ message = "You have no ride history yet." }: { message?: string }) {
    return (
        <div className="text-center py-14 text-muted-foreground">
            <Car className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">{message}</p>
            <Link href="/rides">
                <Button variant="outline" size="sm" className="mt-4">Browse Rides</Button>
            </Link>
        </div>
    );
}
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, collection, query, where, updateDoc, serverTimestamp, increment } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Ride, RideRequest } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Clock, Car, MapPin, Calendar, Users, ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

function parseDate(date: any): Date | null {
    if (!date) return null;
    if (typeof date === "string") return new Date(date);
    if (typeof date.toDate === "function") return date.toDate();
    return null;
}

const RIDE_STATUS_OPTIONS = ["OPEN", "EN_ROUTE", "COMPLETED", "CANCELLED"] as const;

export default function RideDetailPage() {
    const { rideId } = useParams<{ rideId: string }>();
    const { user } = useAuth();
    const router = useRouter();
    const [ride, setRide] = useState<Ride | null>(null);
    const [requests, setRequests] = useState<RideRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, "rides", rideId), (snap) => {
            if (snap.exists()) setRide({ id: snap.id, ...snap.data() } as Ride);
            setLoading(false);
        });
        return () => unsub();
    }, [rideId]);

    useEffect(() => {
        const q = query(collection(db, "rideRequests"), where("rideId", "==", rideId));
        const unsub = onSnapshot(q, (snap) => {
            setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as RideRequest)));
        });
        return () => unsub();
    }, [rideId]);

    const isHost = user?.uid === ride?.hostId;

    const handleAccept = async (req: RideRequest) => {
        if (!req.id || !ride) return;
        try {
            await updateDoc(doc(db, "rideRequests", req.id), { status: "CONFIRMED", updatedAt: serverTimestamp() });
            await updateDoc(doc(db, "rides", ride.id), {
                seatsAvailable: increment(-1),
                passengerIds: [...(ride.passengerIds || []), req.passengerId],
            });
            toast.success(`${req.passengerName} confirmed!`);
        } catch { toast.error("Failed to accept."); }
    };

    const handleReject = async (req: RideRequest) => {
        if (!req.id) return;
        try {
            await updateDoc(doc(db, "rideRequests", req.id), { status: "REJECTED", updatedAt: serverTimestamp() });
            toast.info("Request rejected.");
        } catch { toast.error("Failed to reject."); }
    };

    const handleUpdateRideStatus = async (status: string) => {
        if (!ride) return;
        setUpdatingStatus(true);
        try {
            await updateDoc(doc(db, "rides", ride.id), { status, updatedAt: serverTimestamp() });
            toast.success(`Ride marked as ${status.toLowerCase()}.`);
        } catch { toast.error("Failed to update status."); }
        finally { setUpdatingStatus(false); }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!ride) {
        return <div className="text-center py-20 text-muted-foreground">Ride not found.</div>;
    }

    const originName = typeof ride.origin === "string" ? ride.origin : ride.origin?.name || "Unknown";
    const destName = typeof ride.destination === "string" ? ride.destination : ride.destination?.name || "Unknown";
    const departureDate = parseDate(ride.departureTime);
    const seats = ride.seatsAvailable ?? ride.availableSeats ?? 0;

    const pending = requests.filter(r => r.status === "PENDING");
    const confirmed = requests.filter(r => r.status === "CONFIRMED");
    const others = requests.filter(r => r.status === "REJECTED" || r.status === "CANCELLED");

    const statusColors: Record<string, string> = {
        OPEN: "bg-green-500/10 text-green-600",
        FILLED: "bg-yellow-500/10 text-yellow-600",
        EN_ROUTE: "bg-blue-500/10 text-blue-600",
        COMPLETED: "bg-gray-400/10 text-gray-500",
        CANCELLED: "bg-red-500/10 text-red-500",
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/rides">
                    <Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button>
                </Link>
                <h1 className="text-2xl font-bold">Ride Details</h1>
            </div>

            {/* Ride Info Card */}
            <Card className="border-2">
                <CardHeader className="pb-3">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">
                            {ride.type === "OFFER" ? "🚗 Ride Offer" : "🙋 Ride Request"}
                        </CardTitle>
                        <Badge className={statusColors[ride.status] || ""}>{ride.status}</Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Route */}
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                            <span className="font-medium">{originName}</span>
                        </div>
                        <div className="ml-1 border-l-2 border-dashed border-muted-foreground/30 h-4" />
                        <div className="flex items-center gap-2 text-sm">
                            <MapPin size={12} className="text-red-500 ml-0.5 shrink-0" />
                            <span className="font-medium">{destName}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={14} />
                            <span>{departureDate ? format(departureDate, "MMM d, yyyy · h:mm a") : "TBD"}</span>
                        </div>
                        {ride.type === "OFFER" && (
                            <div className="flex items-center gap-1.5">
                                <Users size={14} />
                                <span>{seats} seat{seats !== 1 ? "s" : ""} remaining</span>
                            </div>
                        )}
                    </div>

                    {/* Host: status controls */}
                    {isHost && ride.status !== "COMPLETED" && ride.status !== "CANCELLED" && (
                        <div className="pt-2 border-t">
                            <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Update ride status</p>
                            <div className="flex flex-wrap gap-2">
                                {ride.status === "OPEN" && (
                                    <Button size="sm" variant="outline" onClick={() => handleUpdateRideStatus("EN_ROUTE")} disabled={updatingStatus}>
                                        🚦 Mark En Route
                                    </Button>
                                )}
                                {(ride.status === "OPEN" || ride.status === "EN_ROUTE") && (
                                    <Button size="sm" variant="outline" className="text-green-600" onClick={() => handleUpdateRideStatus("COMPLETED")} disabled={updatingStatus}>
                                        ✅ Mark Completed
                                    </Button>
                                )}
                                <Button size="sm" variant="outline" className="text-red-500" onClick={() => handleUpdateRideStatus("CANCELLED")} disabled={updatingStatus}>
                                    ❌ Cancel Ride
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pending Requests */}
            {isHost && pending.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Clock size={18} className="text-yellow-500" /> Pending Requests
                        <Badge className="bg-yellow-500/10 text-yellow-600">{pending.length}</Badge>
                    </h2>
                    {pending.map(req => (
                        <RequestRow key={req.id} req={req} onAccept={() => handleAccept(req)} onReject={() => handleReject(req)} showActions />
                    ))}
                </div>
            )}

            {/* Confirmed Passengers */}
            {confirmed.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <CheckCircle size={18} className="text-green-500" /> Confirmed Passengers
                        <Badge className="bg-green-500/10 text-green-600">{confirmed.length}</Badge>
                    </h2>
                    {confirmed.map(req => (
                        <RequestRow key={req.id} req={req} />
                    ))}
                </div>
            )}

            {/* Rejected / Cancelled */}
            {isHost && others.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-medium text-muted-foreground">Other Requests</h2>
                    {others.map(req => (
                        <RequestRow key={req.id} req={req} />
                    ))}
                </div>
            )}

            {requests.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No requests yet.</p>
                </div>
            )}
        </div>
    );
}

function RequestRow({ req, onAccept, onReject, showActions }: {
    req: RideRequest;
    onAccept?: () => void;
    onReject?: () => void;
    showActions?: boolean;
}) {
    const statusStyle: Record<string, string> = {
        PENDING: "bg-yellow-500/10 text-yellow-600",
        CONFIRMED: "bg-green-500/10 text-green-600",
        REJECTED: "bg-red-500/10 text-red-500",
        CANCELLED: "bg-gray-400/10 text-gray-500",
    };

    return (
        <Card className="border">
            <CardContent className="pt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                        <AvatarImage src={req.passengerPhoto} />
                        <AvatarFallback>{req.passengerName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                        <Link href={`/profile/${req.passengerId}`} className="font-medium hover:text-primary transition-colors">
                            {req.passengerName}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                            <Badge className={`text-xs ${statusStyle[req.status] || ""}`}>{req.status}</Badge>
                        </div>
                    </div>
                </div>
                {showActions && req.status === "PENDING" && (
                    <div className="flex gap-2">
                        <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700" onClick={onAccept}>
                            <CheckCircle size={14} /> Accept
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-red-500 border-red-300" onClick={onReject}>
                            <XCircle size={14} /> Reject
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
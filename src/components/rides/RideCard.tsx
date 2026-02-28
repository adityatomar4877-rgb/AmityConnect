"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Ride, RideRequest } from "@/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, Users, Car, MapPin, Clock, CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
    collection, addDoc, query, where, onSnapshot,
    serverTimestamp, updateDoc, doc, increment
} from "firebase/firestore";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

interface RideCardProps {
    ride: Ride;
}

function parseDate(date: any): Date | null {
    if (!date) return null;
    if (typeof date === "string") return new Date(date);
    if (typeof date.toDate === "function") return date.toDate();
    if (date instanceof Date) return date;
    return null;
}

const STATUS_STYLES: Record<string, string> = {
    OPEN: "bg-green-500/10 text-green-600 border-green-500/20",
    FILLED: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    EN_ROUTE: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    COMPLETED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    CANCELLED: "bg-red-500/10 text-red-500 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
    OPEN: "Open",
    FILLED: "Filled",
    EN_ROUTE: "En Route",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
};

export default function RideCard({ ride }: RideCardProps) {
    const { user } = useAuth();
    const [myRequest, setMyRequest] = useState<RideRequest | null>(null);
    const [requesting, setRequesting] = useState(false);

    const isOffer = ride.type === "OFFER";
    const isHost = user?.uid === ride.hostId;
    const departureDate = parseDate(ride.departureTime);
    const userName = ride.userName || ride.hostName || "Anonymous";
    const originName = typeof ride.origin === "string" ? ride.origin : ride.origin?.name || "Unknown";
    const destName = typeof ride.destination === "string" ? ride.destination : ride.destination?.name || "Unknown";
    const seats = ride.availableSeats ?? ride.seatsAvailable ?? 0;

    // Watch current user's request for this ride
    useEffect(() => {
        if (!user || isHost) return;
        const q = query(
            collection(db, "rideRequests"),
            where("rideId", "==", ride.id),
            where("passengerId", "==", user.uid)
        );
        const unsub = onSnapshot(q, (snap) => {
            if (!snap.empty) {
                setMyRequest({ id: snap.docs[0].id, ...snap.docs[0].data() } as RideRequest);
            } else {
                setMyRequest(null);
            }
        });
        return () => unsub();
    }, [user, ride.id, isHost]);

    const handleRequest = async () => {
        if (!user) return;
        setRequesting(true);
        try {
            await addDoc(collection(db, "rideRequests"), {
                rideId: ride.id,
                passengerId: user.uid,
                passengerName: user.displayName || "Anonymous",
                passengerPhoto: user.photoURL || "",
                hostId: ride.hostId,
                status: "PENDING",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            // Notify host
            await createNotification({
                userId: ride.hostId,
                type: "ride_request",
                title: "New Ride Request",
                description: `${user.displayName || "Someone"} wants to join your ride to ${typeof ride.destination === "string" ? ride.destination : ride.destination?.name}`,
                link: `/rides/${ride.id}`,
                senderId: user.uid,
                senderName: user.displayName || "Anonymous",
                senderPhoto: user.photoURL || "",
            });
            toast.success("Request sent! Waiting for the host to confirm.");
        } catch {
            toast.error("Failed to send request. Try again.");
        } finally {
            setRequesting(false);
        }
    };

    const handleCancelRequest = async () => {
        if (!myRequest?.id) return;
        setRequesting(true);
        try {
            await updateDoc(doc(db, "rideRequests", myRequest.id), {
                status: "CANCELLED",
                updatedAt: serverTimestamp(),
            });
            toast.info("Request cancelled.");
        } catch {
            toast.error("Failed to cancel request.");
        } finally {
            setRequesting(false);
        }
    };

    // Host actions
    const handleAccept = async (requestId: string, passengerId: string) => {
        try {
            await updateDoc(doc(db, "rideRequests", requestId), {
                status: "CONFIRMED",
                updatedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, "rides", ride.id), {
                seatsAvailable: increment(-1),
                passengerIds: [...(ride.passengerIds || []), passengerId],
            });
            toast.success("Passenger confirmed!");
        } catch {
            toast.error("Failed to accept request.");
        }
    };

    const handleReject = async (requestId: string) => {
        try {
            await updateDoc(doc(db, "rideRequests", requestId), {
                status: "REJECTED",
                updatedAt: serverTimestamp(),
            });
            toast.info("Request rejected.");
        } catch {
            toast.error("Failed to reject request.");
        }
    };

    const requestStatusBadge = () => {
        if (!myRequest) return null;
        const styles: Record<string, string> = {
            PENDING: "bg-yellow-500/10 text-yellow-600",
            CONFIRMED: "bg-green-500/10 text-green-600",
            REJECTED: "bg-red-500/10 text-red-500",
            CANCELLED: "bg-gray-500/10 text-gray-500",
        };
        const icons: Record<string, React.ReactNode> = {
            PENDING: <Clock size={12} />,
            CONFIRMED: <CheckCircle size={12} />,
            REJECTED: <XCircle size={12} />,
            CANCELLED: <AlertCircle size={12} />,
        };
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[myRequest.status]}`}>
                {icons[myRequest.status]} {myRequest.status}
            </span>
        );
    };

    return (
        <Card className="card-hover border-2 overflow-hidden flex flex-col">
            {/* Color bar */}
            <div className={`h-1.5 ${isOffer ? "bg-gradient-to-r from-blue-500 to-cyan-500" : "bg-gradient-to-r from-purple-500 to-pink-500"}`} />

            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <Link href={`/profile/${ride.hostId}`} className="flex items-center gap-3 group">
                        <Avatar className="h-10 w-10 border-2 border-background shadow-sm group-hover:ring-2 group-hover:ring-primary transition-all">
                            <AvatarImage src={ride.hostPhoto} />
                            <AvatarFallback className={isOffer ? "bg-blue-100 text-blue-600" : "bg-purple-100 text-purple-600"}>
                                {userName[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold group-hover:text-primary transition-colors">{userName}</p>
                            <p className="text-xs text-muted-foreground">
                                {isOffer ? "🚗 Offering a ride" : "🙋 Looking for a ride"}
                            </p>
                        </div>
                    </Link>
                    <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className={STATUS_STYLES[ride.status] || ""}>
                            {STATUS_LABELS[ride.status] || ride.status}
                        </Badge>
                        {requestStatusBadge()}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pb-3 space-y-3 flex-1">
                {/* Route */}
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
                        <p className="font-medium truncate">{originName}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm pl-1">
                        <div className="w-0.5 h-4 bg-muted-foreground/20 ml-1" />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                        <MapPin size={12} className="text-red-500 shrink-0 ml-0.5" />
                        <p className="font-medium truncate">{destName}</p>
                    </div>
                </div>

                {/* Time + Seats */}
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar size={14} />
                        <span>{departureDate ? format(departureDate, "MMM d, h:mm a") : "TBD"}</span>
                    </div>
                    {isOffer && seats > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 text-green-600">
                            <Users size={12} />
                            <span className="text-xs font-medium">{seats} seats</span>
                        </div>
                    )}
                </div>
            </CardContent>

            <CardFooter className="pt-0 flex flex-col gap-2">
                {/* Passenger actions */}
                {!isHost && ride.status === "OPEN" && (
                    <>
                        {!myRequest && (
                            <Button
                                className="w-full gap-2"
                                onClick={handleRequest}
                                disabled={requesting}
                            >
                                {requesting ? <Loader2 size={16} className="animate-spin" /> : <Car size={16} />}
                                {isOffer ? "Request a Seat" : "Offer This Ride"}
                            </Button>
                        )}
                        {myRequest?.status === "PENDING" && (
                            <Button variant="outline" className="w-full gap-2 text-yellow-600 border-yellow-400" onClick={handleCancelRequest} disabled={requesting}>
                                <Clock size={16} /> Pending — Cancel Request
                            </Button>
                        )}
                        {myRequest?.status === "CONFIRMED" && (
                            <div className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-green-500/10 text-green-600 text-sm font-medium">
                                <CheckCircle size={16} /> You're confirmed on this ride!
                            </div>
                        )}
                        {myRequest?.status === "REJECTED" && (
                            <div className="w-full flex items-center justify-center gap-2 p-2 rounded-lg bg-red-500/10 text-red-500 text-sm font-medium">
                                <XCircle size={16} /> Request was rejected
                            </div>
                        )}
                    </>
                )}

                {/* Host: view requests link */}
                {isHost && (
                    <Link href={`/rides/${ride.id}`} className="w-full">
                        <Button variant="outline" className="w-full gap-2">
                            <Users size={16} /> Manage Requests
                        </Button>
                    </Link>
                )}

                {/* Ride not open */}
                {!isHost && ride.status !== "OPEN" && (
                    <div className="w-full text-center text-sm text-muted-foreground py-1">
                        This ride is {STATUS_LABELS[ride.status]?.toLowerCase()}
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}
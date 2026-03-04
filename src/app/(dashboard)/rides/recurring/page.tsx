"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { RecurringRide } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, RefreshCw, MapPin, Clock, Users, BellRing, BellOff, Pause, Play, StopCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

const DAY_LABELS: Record<string, string> = {
    MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun'
};

export default function RecurringRidesPage() {
    const { user } = useAuth();
    const [rides, setRides] = useState<RecurringRide[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, "recurringRides"));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as RecurringRide));
            data.sort((a, b) => {
                const aT = (a.createdAt as any)?.toDate?.()?.getTime() || 0;
                const bT = (b.createdAt as any)?.toDate?.()?.getTime() || 0;
                return bT - aT;
            });
            setRides(data.filter(r => r.status === 'ACTIVE'));
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSubscribe = async (ride: RecurringRide) => {
        if (!user || !ride.id) return;
        const isSubscribed = ride.subscriberIds?.includes(user.uid);
        try {
            await updateDoc(doc(db, "recurringRides", ride.id), {
                subscriberIds: isSubscribed ? arrayRemove(user.uid) : arrayUnion(user.uid)
            });
            if (!isSubscribed) {
                await createNotification({
                    userId: ride.hostId,
                    type: "ride_request",
                    title: "New Recurring Ride Subscriber",
                    description: `${user.displayName} subscribed to your ${ride.days.join('/')} ride to ${ride.destination}`,
                    link: `/rides/recurring`,
                    senderId: user.uid,
                    senderName: user.displayName || "Someone",
                    senderPhoto: user.photoURL || "",
                });
                toast.success("Subscribed! You'll be notified for each occurrence.");
            } else {
                toast.info("Unsubscribed from ride.");
            }
        } catch { toast.error("Failed to update subscription."); }
    };

    const handleStatusChange = async (ride: RecurringRide, status: 'ACTIVE' | 'PAUSED' | 'STOPPED') => {
        if (!ride.id) return;
        try {
            await updateDoc(doc(db, "recurringRides", ride.id), { status });
            toast.success(`Ride ${status.toLowerCase()}.`);
        } catch { toast.error("Failed to update."); }
    };

    const myRides = rides.filter(r => r.hostId === user?.uid);
    const otherRides = rides.filter(r => r.hostId !== user?.uid);

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Link href="/rides"><Button variant="ghost" size="icon"><ArrowLeft size={20} /></Button></Link>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2"><RefreshCw size={20} /> Recurring Rides</h1>
                    <p className="text-sm text-muted-foreground">Weekly rides you can subscribe to</p>
                </div>
            </div>

            {myRides.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Your Recurring Rides</h2>
                    {myRides.map(ride => (
                        <RecurringCard key={ride.id} ride={ride} isOwn onSubscribe={handleSubscribe} onStatusChange={handleStatusChange} currentUserId={user?.uid} />
                    ))}
                </div>
            )}

            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Available Recurring Rides ({otherRides.length})
                </h2>
                {otherRides.length === 0 ? (
                    <div className="text-center py-14 text-muted-foreground">
                        <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p>No recurring rides yet.</p>
                        <Link href="/rides/create">
                            <Button variant="outline" size="sm" className="mt-4">Post Recurring Ride</Button>
                        </Link>
                    </div>
                ) : (
                    otherRides.map(ride => (
                        <RecurringCard key={ride.id} ride={ride} isOwn={false} onSubscribe={handleSubscribe} onStatusChange={handleStatusChange} currentUserId={user?.uid} />
                    ))
                )}
            </div>
        </div>
    );
}

function RecurringCard({ ride, isOwn, onSubscribe, onStatusChange, currentUserId }: {
    ride: RecurringRide;
    isOwn: boolean;
    currentUserId?: string;
    onSubscribe: (ride: RecurringRide) => void;
    onStatusChange: (ride: RecurringRide, status: 'ACTIVE' | 'PAUSED' | 'STOPPED') => void;
}) {
    const isSubscribed = currentUserId ? ride.subscriberIds?.includes(currentUserId) : false;
    const allDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

    return (
        <Card className="border overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 to-violet-500" />
            <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={ride.hostPhoto} />
                            <AvatarFallback>{ride.hostName?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold">{ride.hostName}</p>
                            <p className="text-xs text-muted-foreground">{ride.type === 'OFFER' ? '🚗 Offering' : '🙋 Looking for'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-200 text-xs">
                            <RefreshCw size={10} className="mr-1" /> Weekly
                        </Badge>
                        {ride.seatsAvailable && (
                            <Badge variant="outline" className="text-xs">
                                <Users size={10} className="mr-1" />{ride.seatsAvailable}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Route */}
                <div className="flex items-center gap-2 text-sm bg-muted/40 rounded-lg p-2.5">
                    <div className="flex flex-col items-center gap-0.5 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <div className="w-px h-3 bg-muted-foreground/20" />
                        <MapPin size={8} className="text-red-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium truncate">{ride.origin}</p>
                        <p className="text-muted-foreground truncate text-xs">{ride.destination}</p>
                    </div>
                </div>

                {/* Days + Time */}
                <div className="flex items-center justify-between">
                    <div className="flex gap-1">
                        {allDays.map(day => (
                            <span key={day} className={`text-xs px-1.5 py-0.5 rounded font-medium ${ride.days?.includes(day)
                                ? 'bg-indigo-500/10 text-indigo-600'
                                : 'text-muted-foreground/30'}`}>
                                {DAY_LABELS[day].slice(0, 2)}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={11} />{ride.departureTime}
                    </div>
                </div>

                {/* Subscribers */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                        {ride.subscriberIds?.length || 0} subscriber{ride.subscriberIds?.length !== 1 ? 's' : ''}
                    </span>

                    {/* Actions */}
                    {isOwn ? (
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                                onClick={() => onStatusChange(ride, ride.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')}>
                                {ride.status === 'PAUSED' ? <><Play size={11} />Resume</> : <><Pause size={11} />Pause</>}
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-500 border-red-200"
                                onClick={() => onStatusChange(ride, 'STOPPED')}>
                                <StopCircle size={11} />Stop
                            </Button>
                        </div>
                    ) : (
                        <Button size="sm" variant={isSubscribed ? "outline" : "default"}
                            className={`h-7 text-xs gap-1 ${isSubscribed ? 'text-muted-foreground' : ''}`}
                            onClick={() => onSubscribe(ride)}>
                            {isSubscribed ? <><BellOff size={11} />Unsubscribe</> : <><BellRing size={11} />Subscribe</>}
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
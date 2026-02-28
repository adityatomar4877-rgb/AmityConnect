"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { collection, query, where, limit, onSnapshot, doc, updateDoc, writeBatch, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Bell, MessageCircle, Car, Package, AlertTriangle,
    Check, Loader2, Star, CheckCircle, XCircle, Navigation
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AppNotification {
    id: string;
    type: string;
    title: string;
    description: string;
    read: boolean;
    createdAt: any;
    link?: string;
    senderId?: string;
    senderName?: string;
    senderPhoto?: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
    ride_request: <Car className="h-4 w-4 text-blue-500" />,
    ride_accepted: <CheckCircle className="h-4 w-4 text-green-500" />,
    ride_rejected: <XCircle className="h-4 w-4 text-red-500" />,
    ride_cancelled: <XCircle className="h-4 w-4 text-red-400" />,
    ride_en_route: <Navigation className="h-4 w-4 text-blue-400" />,
    ride_completed: <Star className="h-4 w-4 text-yellow-400" />,
    message: <MessageCircle className="h-4 w-4 text-blue-500" />,
    errand: <Package className="h-4 w-4 text-orange-500" />,
    sos: <AlertTriangle className="h-4 w-4 text-red-500" />,
};

const TYPE_BG: Record<string, string> = {
    ride_request: "bg-blue-100 dark:bg-blue-900/30",
    ride_accepted: "bg-green-100 dark:bg-green-900/30",
    ride_rejected: "bg-red-100 dark:bg-red-900/30",
    ride_cancelled: "bg-red-100 dark:bg-red-900/30",
    ride_en_route: "bg-blue-100 dark:bg-blue-900/30",
    ride_completed: "bg-yellow-100 dark:bg-yellow-900/30",
    message: "bg-blue-100 dark:bg-blue-900/30",
    errand: "bg-orange-100 dark:bg-orange-900/30",
    sos: "bg-red-100 dark:bg-red-900/30",
};

export default function NotificationBell() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showDropdown, setShowDropdown] = useState(false);
    const [loading, setLoading] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handle = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener("mousedown", handle);
        return () => document.removeEventListener("mousedown", handle);
    }, []);

    // Listen to notifications collection
    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "notifications"),
            where("userId", "==", user.uid),
            limit(30)
        );

        const unsub = onSnapshot(q, (snap) => {
            const notifs: AppNotification[] = snap.docs
                .map(d => ({ id: d.id, ...d.data() } as AppNotification))
                .sort((a, b) => {
                    const aT = a.createdAt?.toDate?.()?.getTime() || 0;
                    const bT = b.createdAt?.toDate?.()?.getTime() || 0;
                    return bT - aT;
                });
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.read).length);
            setLoading(false);
        }, (err) => {
            console.error("Notification error:", err);
            setLoading(false);
        });

        return () => unsub();
    }, [user]);

    const markAsRead = async (id: string) => {
        try {
            await updateDoc(doc(db, "notifications", id), { read: true });
        } catch { }
    };

    const markAllAsRead = async () => {
        if (!user) return;
        const unread = notifications.filter(n => !n.read);
        const batch = writeBatch(db);
        unread.forEach(n => batch.update(doc(db, "notifications", n.id), { read: true }));
        await batch.commit();
    };

    const formatTime = (createdAt: any) => {
        try {
            const date = createdAt?.toDate?.() || new Date(createdAt);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch {
            return "Just now";
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDropdown(!showDropdown)}
                className="relative"
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </Button>

            {showDropdown && (
                <div className="absolute top-full right-0 mt-2 w-80 bg-popover border rounded-xl shadow-xl z-50 overflow-hidden">
                    {/* Header */}
                    <div className="p-3 border-b flex items-center justify-between bg-muted/30">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold">Notifications</h3>
                            {unreadCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        {unreadCount > 0 && (
                            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7 gap-1">
                                <Check className="h-3 w-3" /> Mark all read
                            </Button>
                        )}
                    </div>

                    {/* List */}
                    <div className="max-h-[420px] overflow-y-auto divide-y">
                        {loading ? (
                            <div className="p-8 text-center">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground">
                                <Bell className="h-10 w-10 mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-medium">You're all caught up!</p>
                                <p className="text-xs mt-1">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.slice(0, 20).map((notif) => (
                                <Link
                                    key={notif.id}
                                    href={notif.link || "#"}
                                    onClick={() => {
                                        if (!notif.read) markAsRead(notif.id);
                                        setShowDropdown(false);
                                    }}
                                >
                                    <div className={`p-3 hover:bg-muted/50 transition-colors flex gap-3 ${!notif.read ? "bg-primary/5" : ""}`}>
                                        {/* Avatar or icon */}
                                        <div className="shrink-0 mt-0.5">
                                            {notif.senderPhoto ? (
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={notif.senderPhoto} />
                                                    <AvatarFallback className="text-xs">
                                                        {notif.senderName?.[0]?.toUpperCase() || "?"}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ) : (
                                                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${TYPE_BG[notif.type] || "bg-muted"}`}>
                                                    {TYPE_ICON[notif.type] || <Bell className="h-4 w-4" />}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm leading-snug ${!notif.read ? "font-semibold" : ""}`}>
                                                {notif.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                                {notif.description}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {formatTime(notif.createdAt)}
                                            </p>
                                        </div>

                                        {!notif.read && (
                                            <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                                        )}
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
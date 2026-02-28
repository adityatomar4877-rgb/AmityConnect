"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { Star, StarHalf } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RideRating } from "@/types";
import { format } from "date-fns";

interface RatingDisplayProps {
    userId: string;
    ratingSum?: number;
    ratingCount?: number;
    showReviews?: boolean;
}

function StarRow({ rating }: { rating: number }) {
    return (
        <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <Star
                    key={s}
                    size={14}
                    className={s <= Math.round(rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground/20"}
                />
            ))}
        </div>
    );
}

export function RatingSummary({ ratingSum = 0, ratingCount = 0 }: { ratingSum?: number; ratingCount?: number }) {
    if (ratingCount === 0) {
        return <span className="text-xs text-muted-foreground">No ratings yet</span>;
    }
    const avg = ratingSum / ratingCount;
    return (
        <div className="flex items-center gap-1.5">
            <StarRow rating={avg} />
            <span className="text-sm font-semibold">{avg.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({ratingCount})</span>
        </div>
    );
}

export default function RatingDisplay({ userId, ratingSum = 0, ratingCount = 0, showReviews = false }: RatingDisplayProps) {
    const [reviews, setReviews] = useState<RideRating[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);

    useEffect(() => {
        if (!showReviews) return;
        const fetchReviews = async () => {
            setLoadingReviews(true);
            try {
                const q = query(
                    collection(db, "rideRatings"),
                    where("ratedUserId", "==", userId),
                    limit(5)
                );
                const snap = await getDocs(q);
                setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as RideRating)));
            } catch { }
            finally { setLoadingReviews(false); }
        };
        fetchReviews();
    }, [userId, showReviews]);

    const avg = ratingCount > 0 ? ratingSum / ratingCount : 0;

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-yellow-500/5 border border-yellow-200/30">
                <div className="text-center">
                    <p className="text-4xl font-bold text-yellow-500">{ratingCount > 0 ? avg.toFixed(1) : "—"}</p>
                    <StarRow rating={avg} />
                    <p className="text-xs text-muted-foreground mt-1">{ratingCount} review{ratingCount !== 1 ? "s" : ""}</p>
                </div>
                {/* Bar chart */}
                <div className="flex-1 space-y-1">
                    {[5, 4, 3, 2, 1].map((star) => {
                        const pct = ratingCount > 0 ? Math.round((reviews.filter(r => r.rating === star).length / ratingCount) * 100) : 0;
                        return (
                            <div key={star} className="flex items-center gap-2 text-xs">
                                <span className="w-2 text-muted-foreground">{star}</span>
                                <Star size={10} className="fill-yellow-400 text-yellow-400 shrink-0" />
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="w-6 text-right text-muted-foreground">{pct}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Reviews list */}
            {showReviews && reviews.length > 0 && (
                <div className="space-y-3">
                    <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Reviews</p>
                    {reviews.map((r) => (
                        <div key={r.id} className="flex gap-3 p-3 rounded-lg border">
                            <Avatar className="h-8 w-8 shrink-0">
                                <AvatarImage src={r.raterPhoto} />
                                <AvatarFallback>{r.raterName?.[0]?.toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium">{r.raterName}</p>
                                    <StarRow rating={r.rating} />
                                </div>
                                {r.comment && <p className="text-sm text-muted-foreground mt-0.5">{r.comment}</p>}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
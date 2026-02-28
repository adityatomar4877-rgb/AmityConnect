"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp, updateDoc, doc, increment } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, X, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface RateRideModalProps {
    rideId: string;
    ratedUserId: string;
    ratedUserName: string;
    ratedUserPhoto?: string;
    role: "host" | "passenger"; // who you're rating
    onClose: () => void;
    onDone: () => void;
}

export default function RateRideModal({
    rideId, ratedUserId, ratedUserName, ratedUserPhoto, role, onClose, onDone
}: RateRideModalProps) {
    const { user } = useAuth();
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [comment, setComment] = useState("");
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const labels = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

    const handleSubmit = async () => {
        if (!user || rating === 0) return;
        setLoading(true);
        try {
            // Save rating doc
            await addDoc(collection(db, "rideRatings"), {
                rideId,
                raterId: user.uid,
                raterName: user.displayName || "Anonymous",
                raterPhoto: user.photoURL || "",
                ratedUserId,
                rating,
                comment: comment.trim(),
                createdAt: serverTimestamp(),
            });

            // Update user's rating aggregate
            await updateDoc(doc(db, "users", ratedUserId), {
                ratingSum: increment(rating),
                ratingCount: increment(1),
            });

            setDone(true);
            toast.success("Rating submitted!");
            setTimeout(() => { onDone(); }, 1200);
        } catch {
            toast.error("Failed to submit rating.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <Card className="w-full max-w-md border-2 shadow-2xl">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Rate Your {role === "host" ? "Driver" : "Passenger"}</CardTitle>
                            <CardDescription>How was your experience?</CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X size={18} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-5">
                    {done ? (
                        <div className="text-center py-6">
                            <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
                            <p className="text-lg font-semibold">Rating Submitted!</p>
                            <p className="text-sm text-muted-foreground">Thank you for your feedback.</p>
                        </div>
                    ) : (
                        <>
                            {/* User being rated */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                                <Avatar className="h-12 w-12">
                                    <AvatarImage src={ratedUserPhoto} />
                                    <AvatarFallback>{ratedUserName[0]?.toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{ratedUserName}</p>
                                    <p className="text-xs text-muted-foreground capitalize">{role}</p>
                                </div>
                            </div>

                            {/* Stars */}
                            <div className="space-y-2">
                                <div className="flex justify-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onMouseEnter={() => setHovered(star)}
                                            onMouseLeave={() => setHovered(0)}
                                            onClick={() => setRating(star)}
                                            className="transition-transform hover:scale-110 focus:outline-none"
                                        >
                                            <Star
                                                size={36}
                                                className={`transition-colors ${star <= (hovered || rating)
                                                        ? "fill-yellow-400 text-yellow-400"
                                                        : "text-muted-foreground/30"
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                {(hovered || rating) > 0 && (
                                    <p className="text-center text-sm font-medium text-yellow-500">
                                        {labels[hovered || rating]}
                                    </p>
                                )}
                            </div>

                            {/* Comment */}
                            <Textarea
                                placeholder="Add a comment (optional)..."
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={3}
                                className="resize-none"
                            />

                            <Button
                                className="w-full"
                                onClick={handleSubmit}
                                disabled={rating === 0 || loading}
                            >
                                {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                                Submit Rating
                            </Button>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
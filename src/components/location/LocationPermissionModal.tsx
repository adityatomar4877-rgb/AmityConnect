"use client";

import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, X, Loader2, ShieldCheck } from "lucide-react";

interface LocationPermissionModalProps {
    onComplete: () => void;
}

export default function LocationPermissionModal({ onComplete }: LocationPermissionModalProps) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleAllow = () => {
        setLoading(true);
        setError("");

        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    if (user) {
                        await setDoc(doc(db, "users", user.uid), {
                            location: { lat: latitude, lng: longitude },
                            locationUpdatedAt: new Date(),
                        }, { merge: true });
                    }
                    // Save to sessionStorage so map can use it immediately
                    sessionStorage.setItem("userLocation", JSON.stringify({ lat: latitude, lng: longitude }));
                    onComplete();
                } catch (err) {
                    console.error("Error saving location:", err);
                    onComplete(); // Still proceed even if save fails
                } finally {
                    setLoading(false);
                }
            },
            (err) => {
                console.error("Geolocation error:", err);
                setError("Unable to retrieve your location. Please check browser permissions.");
                setLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSkip = () => {
        // Mark as skipped so we don't ask again this session
        sessionStorage.setItem("locationPromptDone", "true");
        onComplete();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <Card className="w-full max-w-md border-2 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <MapPin className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Enable Location</CardTitle>
                    <CardDescription className="text-base mt-1">
                        AmityConnect wants to show your location on the campus map and help nearby students find you.
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                    {/* Privacy note */}
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400">
                        <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" />
                        <p className="text-sm">
                            Your location is only visible to verified members of AmityConnect and is never shared with third parties.
                        </p>
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-500/10 p-3 rounded-lg">
                            <X className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="space-y-3 pt-2">
                        <Button
                            className="w-full h-12 text-base gap-2"
                            onClick={handleAllow}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    Getting location...
                                </>
                            ) : (
                                <>
                                    <MapPin className="h-5 w-5" />
                                    Allow Location Access
                                </>
                            )}
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full text-muted-foreground"
                            onClick={handleSkip}
                            disabled={loading}
                        >
                            Skip for now
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
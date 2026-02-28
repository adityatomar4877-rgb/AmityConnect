"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Car, ShoppingBag, AlertTriangle, Sparkles, ArrowRight, Loader2, Shield, MapPin, MapPinOff } from "lucide-react";
import Link from "next/link";
import DashboardMap from "@/components/map/DashboardMap";
import LocationPermissionModal from "@/components/location/LocationPermissionModal";
import { UserProfile } from "@/types";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);

  const handleToggleLocation = async () => {
    if (locationEnabled) {
      // Turn OFF — clear state, sessionStorage, and Firestore
      setUserLocation(null);
      setLocationEnabled(false);
      sessionStorage.removeItem("userLocation");
      sessionStorage.setItem("locationPromptDone", "true");
      if (user) {
        await setDoc(doc(db, "users", user.uid), { location: null }, { merge: true });
      }
    } else {
      // Turn ON — ask for location again
      sessionStorage.removeItem("locationPromptDone");
      setShowLocationModal(true);
    }
  };

  useEffect(() => {
    // Redirect to landing page if not logged in
    if (!loading && !user) {
      router.push("/landing");
      return;
    }

    // Fetch user profile to check role
    if (user) {
      const fetchProfile = async () => {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const profile = docSnap.data() as UserProfile;
            setUserProfile(profile);

            // Redirect faculty/admin to faculty dashboard
            if (profile.role === 'faculty' || profile.role === 'admin') {
              router.push("/faculty");
              return;
            }

            // Check if we already have location in session (page was refreshed)
            const sessionLoc = sessionStorage.getItem("userLocation");
            const promptDone = sessionStorage.getItem("locationPromptDone");

            if (sessionLoc) {
              setUserLocation(JSON.parse(sessionLoc));
              setLocationEnabled(true);
            } else if (profile.location) {
              setUserLocation(profile.location);
              setLocationEnabled(true);
              sessionStorage.setItem("userLocation", JSON.stringify(profile.location));
            } else if (!promptDone) {
              // No location saved & not skipped — ask for it
              setShowLocationModal(true);
            }
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        } finally {
          setProfileLoading(false);
        }
      };
      fetchProfile();
    }
  }, [user, loading, router]);

  const handleLocationModalComplete = () => {
    setShowLocationModal(false);
    const saved = sessionStorage.getItem("userLocation");
    if (saved) {
      setUserLocation(JSON.parse(saved));
      setLocationEnabled(true);
    }
  };

  // Show loading while checking auth
  if (loading || profileLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show nothing while redirecting
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-12">
      {/* Location Permission Modal */}
      {showLocationModal && (
        <LocationPermissionModal onComplete={handleLocationModalComplete} />
      )}
      {/* Hero Section with gradient background */}
      <section className="relative text-center space-y-6 py-16 px-4 rounded-3xl hero-gradient overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-10 left-10 w-20 h-20 bg-blue-500/20 rounded-full blur-xl animate-float" />
        <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-500/20 rounded-full blur-xl animate-float" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-pink-500/20 rounded-full blur-xl animate-float" style={{ animationDelay: "2s" }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Sparkles className="h-4 w-4" />
            Welcome back, {user.displayName || "Student"}!
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight gradient-text animate-gradient-x leading-tight">
            Your Dashboard
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mt-6">
            Find rides, get errands done, and stay safe on campus.
            What would you like to do today?
          </p>

          <div className="flex flex-wrap justify-center gap-4 mt-8">
            <Link href="/rides" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full font-medium hover:opacity-90 transition-opacity">
              Find a Ride <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/sos" className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full font-medium hover:bg-red-700 transition-colors">
              <AlertTriangle className="h-4 w-4" /> Emergency SOS
            </Link>
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link href="/rides" className="block group">
          <Card className="h-full card-hover border-2 border-blue-200/50 dark:border-blue-500/20 bg-gradient-to-br from-blue-50 to-transparent dark:from-blue-950/30 dark:to-transparent">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-blue-600 dark:text-blue-400">Ride Board</CardTitle>
              <CardDescription>Find a ride or offer empty seats</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Save money and environment by carpooling with fellow students.
                Real-time tracking available.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/errands" className="block group">
          <Card className="h-full card-hover border-2 border-green-200/50 dark:border-green-500/20 bg-gradient-to-br from-green-50 to-transparent dark:from-green-950/30 dark:to-transparent">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <ShoppingBag className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-green-600 dark:text-green-400">Errand Requests</CardTitle>
              <CardDescription>Need something? Ask a traveler.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Post requests for coffee, food, or supplies. Helpers earn rewards
                for delivery.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sos" className="block group">
          <Card className="h-full card-hover border-2 border-red-300/50 dark:border-red-500/30 bg-gradient-to-br from-red-50 to-transparent dark:from-red-950/30 dark:to-transparent glow-red">
            <CardHeader>
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform animate-pulse">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-red-600">Emergency SOS</CardTitle>
              <CardDescription>Instant help when you need it</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Share your live location with campus security and friends
                instantly.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Map Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl sm:text-3xl font-bold">Live Campus Map</h2>
          <div className="flex items-center gap-3">
            {/* Location Toggle Button */}
            <button
              onClick={handleToggleLocation}
              className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border-2 transition-all ${locationEnabled
                  ? "bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20 dark:text-blue-400"
                  : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                }`}
            >
              {locationEnabled ? (
                <><MapPin className="h-4 w-4" /> Location ON</>
              ) : (
                <><MapPinOff className="h-4 w-4" /> Location OFF</>
              )}
            </button>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
        </div>
        <div className="border-2 border-border rounded-2xl overflow-hidden shadow-lg">
          <DashboardMap userLocation={userLocation} />
        </div>
      </section>
    </div>
  );
}
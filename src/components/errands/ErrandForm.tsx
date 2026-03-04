"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { ErrandCategory } from "@/types";

const CATEGORIES: { value: ErrandCategory; label: string; emoji: string }[] = [
    { value: 'Food', label: 'Food', emoji: '🍔' },
    { value: 'Stationery', label: 'Stationery', emoji: '✏️' },
    { value: 'Medicine', label: 'Medicine', emoji: '💊' },
    { value: 'Printing', label: 'Printing', emoji: '🖨️' },
    { value: 'Library', label: 'Library', emoji: '📚' },
    { value: 'Transport', label: 'Transport', emoji: '🚌' },
    { value: 'Other', label: 'Other', emoji: '📦' },
];

export default function ErrandForm() {
    const { user } = useAuth();
    const router = useRouter();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [location, setLocation] = useState("");
    const [reward, setReward] = useState("");
    const [category, setCategory] = useState<ErrandCategory>('Other');
    const [deadline, setDeadline] = useState("");
    const [deadlineTime, setDeadlineTime] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setLoading(true);
        setError("");

        try {
            const deadlineDate = deadline && deadlineTime ? new Date(`${deadline}T${deadlineTime}`) : null;

            await addDoc(collection(db, "errands"), {
                requesterId: user.uid,
                requesterName: user.displayName || "Anonymous",
                requesterPhoto: user.photoURL || "",
                title,
                description,
                location,
                reward,
                category,
                deadline: deadlineDate ? deadlineDate.toISOString() : null,
                status: 'OPEN',
                createdAt: serverTimestamp(),
            });

            router.push("/errands");
        } catch (err: any) {
            setError(err.message || "Failed to post errand");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Category */}
                    <div className="space-y-2">
                        <Label>Category</Label>
                        <div className="grid grid-cols-4 gap-2">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.value}
                                    type="button"
                                    onClick={() => setCategory(cat.value)}
                                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-xs font-medium transition-all ${category === cat.value
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-muted hover:border-primary/40'}`}
                                >
                                    <span className="text-xl">{cat.emoji}</span>
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Title</Label>
                        <Input placeholder="e.g., Buy me a coffee" value={title} onChange={e => setTitle(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea placeholder="Details about what you need..." value={description} onChange={e => setDescription(e.target.value)} required />
                    </div>

                    <div className="space-y-2">
                        <Label>Delivery Location</Label>
                        <Input placeholder="Where to deliver/meet?" value={location} onChange={e => setLocation(e.target.value)} required />
                    </div>

                    {/* Deadline */}
                    <div className="space-y-2">
                        <Label>Deadline (Optional)</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                            <Input type="time" value={deadlineTime} onChange={e => setDeadlineTime(e.target.value)} placeholder="Time" />
                        </div>
                        <p className="text-xs text-muted-foreground">When do you need this by?</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Reward (Optional)</Label>
                        <Input placeholder="e.g., ₹50 + keep the change" value={reward} onChange={e => setReward(e.target.value)} />
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
                            <AlertCircle size={16} /><span>{error}</span>
                        </div>
                    )}

                    <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
                        {loading ? "Posting..." : "Post Errand Request"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
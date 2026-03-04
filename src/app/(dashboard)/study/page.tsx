"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, arrayRemove } from "firebase/firestore";
import { StudyGroup } from "@/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    BookOpen, Plus, X, Users, MapPin, Monitor,
    Loader2, Calendar, Tag, Search
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

const SUBJECTS = ['DSA', 'Math', 'Physics', 'Chemistry', 'Programming', 'DBMS', 'OS', 'Networks', 'AI/ML', 'Other'];

function parseDate(date: any): Date | null {
    if (!date) return null;
    if (typeof date === 'string') return new Date(date);
    if (typeof date.toDate === 'function') return date.toDate();
    return null;
}

export default function StudyGroupPage() {
    const { user } = useAuth();
    const [groups, setGroups] = useState<StudyGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Form state
    const [subject, setSubject] = useState("");
    const [topic, setTopic] = useState("");
    const [description, setDescription] = useState("");
    const [maxMembers, setMaxMembers] = useState(5);
    const [meetingType, setMeetingType] = useState<'Online' | 'In-Person'>('In-Person');
    const [location, setLocation] = useState("");
    const [scheduledDate, setScheduledDate] = useState("");
    const [scheduledTime, setScheduledTime] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [posting, setPosting] = useState(false);

    useEffect(() => {
        const unsub = onSnapshot(query(collection(db, "studyGroups")), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as StudyGroup))
                .filter(g => g.status !== 'CLOSED')
                .sort((a, b) => (parseDate(b.createdAt)?.getTime() || 0) - (parseDate(a.createdAt)?.getTime() || 0));
            setGroups(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags(prev => [...prev, tagInput.trim()]);
            setTagInput("");
        }
    };

    const handlePost = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setPosting(true);
        try {
            const scheduledAt = scheduledDate && scheduledTime ? new Date(`${scheduledDate}T${scheduledTime}`).toISOString() : null;
            await addDoc(collection(db, "studyGroups"), {
                hostId: user.uid,
                hostName: user.displayName || "Anonymous",
                hostPhoto: user.photoURL || "",
                subject, topic, description, maxMembers,
                meetingType,
                location: meetingType === 'In-Person' ? location : '',
                scheduledAt,
                tags,
                memberIds: [user.uid],
                memberNames: [user.displayName || "Anonymous"],
                status: 'OPEN',
                createdAt: serverTimestamp(),
            });
            toast.success("Study group posted!");
            setShowForm(false);
            setSubject(""); setTopic(""); setDescription(""); setTags([]);
        } catch { toast.error("Failed to post."); }
        finally { setPosting(false); }
    };

    const handleJoin = async (group: StudyGroup) => {
        if (!user || !group.id) return;
        const isMember = group.memberIds?.includes(user.uid);
        try {
            if (isMember) {
                await updateDoc(doc(db, "studyGroups", group.id), {
                    memberIds: arrayRemove(user.uid),
                    memberNames: group.memberNames?.filter(n => n !== user.displayName) || [],
                });
                toast.info("Left study group.");
            } else {
                if ((group.memberIds?.length || 0) >= group.maxMembers) {
                    toast.error("Group is full!"); return;
                }
                await updateDoc(doc(db, "studyGroups", group.id), {
                    memberIds: arrayUnion(user.uid),
                    memberNames: arrayUnion(user.displayName || "Anonymous"),
                });
                await createNotification({
                    userId: group.hostId,
                    type: "errand",
                    title: "Someone joined your study group!",
                    description: `${user.displayName} joined your ${group.subject} study group.`,
                    link: "/study",
                    senderId: user.uid,
                    senderName: user.displayName || "Anonymous",
                    senderPhoto: user.photoURL || "",
                });
                toast.success("Joined! Good luck studying 📚");
            }
        } catch { toast.error("Failed to update."); }
    };

    const filtered = groups.filter(g =>
        !searchQuery ||
        g.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BookOpen className="text-primary" /> Study Groups
                    </h1>
                    <p className="text-muted-foreground">Find or create study partners for any subject.</p>
                </div>
                <Button className="gap-2" onClick={() => setShowForm(!showForm)}>
                    {showForm ? <X size={16} /> : <Plus size={16} />}
                    {showForm ? "Cancel" : "Create Group"}
                </Button>
            </div>

            {/* Create Form */}
            {showForm && (
                <Card className="border-2 border-primary/20">
                    <CardContent className="pt-6">
                        <form onSubmit={handlePost} className="space-y-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Subject</Label>
                                    <div className="flex flex-wrap gap-1.5">
                                        {SUBJECTS.map(s => (
                                            <button key={s} type="button"
                                                onClick={() => setSubject(s)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${subject === s ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30 hover:border-primary'}`}>
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                    <Input placeholder="Or type custom subject..." value={subject} onChange={e => setSubject(e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Topic / Chapter</Label>
                                    <Input placeholder="e.g., Binary Trees, Sorting Algorithms" value={topic} onChange={e => setTopic(e.target.value)} required />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea placeholder="What will you cover? Any prerequisites?" value={description} onChange={e => setDescription(e.target.value)} rows={2} />
                            </div>

                            <div className="grid sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Max Members</Label>
                                    <Input type="number" min={2} max={20} value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Meeting Type</Label>
                                    <div className="flex gap-2">
                                        {(['In-Person', 'Online'] as const).map(t => (
                                            <button key={t} type="button"
                                                onClick={() => setMeetingType(t)}
                                                className={`flex-1 py-2 text-xs font-medium rounded-lg border-2 transition-all ${meetingType === t ? 'border-primary bg-primary/5 text-primary' : 'border-muted'}`}>
                                                {t === 'Online' ? '💻' : '📍'} {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>{meetingType === 'In-Person' ? 'Location' : 'Platform'}</Label>
                                    <Input placeholder={meetingType === 'In-Person' ? 'Library, Room 204...' : 'Google Meet, Discord...'} value={location} onChange={e => setLocation(e.target.value)} />
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Scheduled Date (Optional)</Label>
                                    <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Time</Label>
                                    <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="space-y-2">
                                <Label>Tags</Label>
                                <div className="flex gap-2">
                                    <Input placeholder="e.g., exam prep, beginner..." value={tagInput}
                                        onChange={e => setTagInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} />
                                    <Button type="button" variant="outline" onClick={addTag}>Add</Button>
                                </div>
                                {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {tags.map(t => (
                                            <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
                                                #{t} <button type="button" onClick={() => setTags(prev => prev.filter(x => x !== t))}><X size={10} /></button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Button type="submit" className="w-full" disabled={posting}>
                                {posting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                                Create Study Group
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search by subject, topic, or tag..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Open Groups', value: groups.filter(g => g.status === 'OPEN').length, color: 'text-green-600', bg: 'bg-green-500/5 border-green-200/50' },
                    { label: 'My Groups', value: groups.filter(g => g.memberIds?.includes(user?.uid || '')).length, color: 'text-blue-600', bg: 'bg-blue-500/5 border-blue-200/50' },
                    { label: 'Subjects', value: new Set(groups.map(g => g.subject)).size, color: 'text-purple-600', bg: 'bg-purple-500/5 border-purple-200/50' },
                ].map(s => (
                    <div key={s.label} className={`rounded-xl border p-3 ${s.bg}`}>
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Groups Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    [1, 2, 3].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)
                ) : filtered.length === 0 ? (
                    <div className="col-span-full text-center py-14 text-muted-foreground">
                        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                        <p className="font-medium">No study groups found.</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                            Create First Group
                        </Button>
                    </div>
                ) : (
                    filtered.map(group => (
                        <StudyGroupCard key={group.id} group={group} currentUserId={user?.uid} onJoin={handleJoin} />
                    ))
                )}
            </div>
        </div>
    );
}

function StudyGroupCard({ group, currentUserId, onJoin }: {
    group: StudyGroup;
    currentUserId?: string;
    onJoin: (group: StudyGroup) => void;
}) {
    const isMember = currentUserId ? group.memberIds?.includes(currentUserId) : false;
    const isHost = currentUserId === group.hostId;
    const isFull = (group.memberIds?.length || 0) >= group.maxMembers;
    const scheduledDate = parseDate(group.scheduledAt);

    return (
        <Card className="border-2 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
            <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
            <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <p className="font-bold text-base">{group.subject}</p>
                        <p className="text-sm text-muted-foreground">{group.topic}</p>
                    </div>
                    <Badge variant="outline" className={isFull ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-600"}>
                        {isFull ? 'Full' : `${group.memberIds?.length || 1}/${group.maxMembers}`}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="pb-3 flex-1 space-y-2">
                {group.description && <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>}

                <div className="flex flex-wrap gap-1.5 text-xs">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${group.meetingType === 'Online' ? 'bg-blue-500/10 text-blue-600' : 'bg-green-500/10 text-green-600'}`}>
                        {group.meetingType === 'Online' ? <Monitor size={10} /> : <MapPin size={10} />}
                        {group.meetingType === 'Online' ? group.location || 'Online' : group.location || 'In-Person'}
                    </span>
                    {scheduledDate && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
                            <Calendar size={10} /> {format(scheduledDate, 'MMM d, h:mm a')}
                        </span>
                    )}
                </div>

                {group.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {group.tags.map(t => (
                            <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">#{t}</span>
                        ))}
                    </div>
                )}

                {/* Members */}
                <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                        {(group.memberNames || []).slice(0, 4).map((name, i) => (
                            <div key={i} className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center border-2 border-background font-semibold">
                                {name[0]?.toUpperCase()}
                            </div>
                        ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {group.hostName} + {(group.memberIds?.length || 1) - 1} more
                    </span>
                </div>
            </CardContent>

            <CardFooter className="pt-0">
                {!isHost && (
                    <Button
                        className="w-full"
                        variant={isMember ? "outline" : "default"}
                        onClick={() => onJoin(group)}
                        disabled={!isMember && isFull}
                    >
                        {isMember ? 'Leave Group' : isFull ? 'Group Full' : 'Join Group'}
                    </Button>
                )}
                {isHost && (
                    <div className="w-full text-center text-xs text-muted-foreground py-1">
                        👑 You created this group
                    </div>
                )}
            </CardFooter>
        </Card>
    );
}
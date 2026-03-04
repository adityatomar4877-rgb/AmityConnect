"use client";

import { Errand } from "@/types";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Gift, Clock, CheckCircle, Loader2, AlertCircle, Timer } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface ErrandCardProps {
    errand: Errand & { category?: string; deadline?: string; requesterPhoto?: string };
    onAccept?: (errandId: string) => void;
    onComplete?: (errandId: string) => void;
}

function parseDate(date: any): Date | null {
    if (!date) return null;
    if (typeof date === 'string') return new Date(date);
    if (typeof date.toDate === 'function') return date.toDate();
    return null;
}

const CATEGORY_EMOJI: Record<string, string> = {
    Food: '🍔', Stationery: '✏️', Medicine: '💊', Printing: '🖨️',
    Library: '📚', Transport: '🚌', Other: '📦'
};

const statusColors = {
    OPEN: 'bg-green-500/10 text-green-600 border-green-500/20',
    IN_PROGRESS: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    COMPLETED: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

export default function ErrandCard({ errand, onAccept, onComplete }: ErrandCardProps) {
    const { user } = useAuth();
    const isOwner = user?.uid === errand.requesterId;
    const isHelper = user?.uid === errand.helperId;
    const createdDate = parseDate(errand.createdAt);
    const deadlineDate = errand.deadline ? new Date(errand.deadline) : null;
    const isUrgent = deadlineDate ? !isPast(deadlineDate) && (deadlineDate.getTime() - Date.now()) < 2 * 60 * 60 * 1000 : false;
    const isExpired = deadlineDate ? isPast(deadlineDate) : false;

    return (
        <Card className="card-hover border-2 overflow-hidden flex flex-col">
            <div className={`h-1.5 ${errand.status === 'OPEN' ? 'bg-gradient-to-r from-green-500 to-emerald-400'
                : errand.status === 'IN_PROGRESS' ? 'bg-gradient-to-r from-orange-500 to-yellow-400'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-400'}`} />

            <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                    <Link href={`/profile/${errand.requesterId}`} className="flex items-center gap-3 group">
                        <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                            <AvatarImage src={errand.requesterPhoto} />
                            <AvatarFallback className="bg-green-100 text-green-600 text-sm">
                                {errand.requesterName?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <p className="font-semibold text-sm group-hover:text-primary transition-colors">{errand.requesterName || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground">
                                {createdDate ? formatDistanceToNow(createdDate, { addSuffix: true }) : 'Just now'}
                            </p>
                        </div>
                    </Link>
                    <div className="flex flex-col items-end gap-1">
                        <Badge className={statusColors[errand.status] || statusColors.OPEN} variant="outline">
                            {errand.status === 'IN_PROGRESS' ? 'In Progress' : errand.status}
                        </Badge>
                        {errand.category && (
                            <span className="text-xs text-muted-foreground">
                                {CATEGORY_EMOJI[errand.category] || '📦'} {errand.category}
                            </span>
                        )}
                    </div>
                </div>
                <CardTitle className="mt-2 text-base">{errand.title}</CardTitle>
            </CardHeader>

            <CardContent className="pb-3 space-y-3 flex-1">
                <p className="text-sm text-muted-foreground line-clamp-2">{errand.description}</p>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin size={14} />
                        <span className="truncate">{errand.location}</span>
                    </div>

                    {deadlineDate && (
                        <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded-lg ${isExpired ? 'bg-red-500/10 text-red-500'
                            : isUrgent ? 'bg-orange-500/10 text-orange-600 animate-pulse'
                                : 'bg-muted/50 text-muted-foreground'}`}>
                            {isExpired ? <AlertCircle size={12} /> : <Timer size={12} />}
                            {isExpired ? 'Deadline passed'
                                : isUrgent ? `Due soon: ${format(deadlineDate, 'h:mm a')}`
                                    : `Due: ${format(deadlineDate, 'MMM d, h:mm a')}`}
                        </div>
                    )}

                    {errand.reward && (
                        <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-green-500/10 text-green-600 w-fit">
                            <Gift size={12} />
                            <span className="text-xs font-medium">{errand.reward}</span>
                        </div>
                    )}
                </div>
            </CardContent>

            <CardFooter className="pt-0">
                {isOwner && errand.status === 'IN_PROGRESS' && (
                    <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={() => onComplete?.(errand.id)}>
                        <CheckCircle size={16} /> Mark as Completed
                    </Button>
                )}
                {!isOwner && errand.status === 'OPEN' && !isExpired && (
                    <Button className="w-full gap-2" onClick={() => onAccept?.(errand.id)}>
                        Accept Errand
                    </Button>
                )}
                {errand.status === 'COMPLETED' && (
                    <Button variant="outline" className="w-full gap-2" disabled>
                        <CheckCircle size={16} /> Completed
                    </Button>
                )}
                {isHelper && errand.status === 'IN_PROGRESS' && (
                    <Button variant="secondary" className="w-full gap-2" disabled>
                        <Loader2 size={16} className="animate-spin" /> In Progress...
                    </Button>
                )}
                {isExpired && errand.status === 'OPEN' && (
                    <Button variant="outline" className="w-full gap-2 text-red-500" disabled>
                        <AlertCircle size={16} /> Deadline Passed
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}
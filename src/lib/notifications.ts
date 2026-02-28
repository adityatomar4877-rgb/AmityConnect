import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

export type NotificationType =
    | "ride_request"       // someone requested your ride
    | "ride_accepted"      // your request was accepted
    | "ride_rejected"      // your request was rejected
    | "ride_cancelled"     // host cancelled the ride
    | "ride_en_route"      // host marked ride as en route
    | "ride_completed"     // ride completed — rate now
    | "message"            // new message
    | "errand"             // errand update
    | "sos";               // SOS alert

interface CreateNotificationParams {
    userId: string;         // who receives it
    type: NotificationType;
    title: string;
    description: string;
    link?: string;
    senderId?: string;
    senderName?: string;
    senderPhoto?: string;
}

export async function createNotification(params: CreateNotificationParams) {
    try {
        await addDoc(collection(db, "notifications"), {
            ...params,
            read: false,
            createdAt: serverTimestamp(),
        });
    } catch (err) {
        console.error("Failed to create notification:", err);
    }
}
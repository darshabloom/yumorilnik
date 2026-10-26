/**
 * Localhost-only fictional booking records.
 * This is NOT a production reservation, ticket or marketing-contact database.
 */
export type DemoGuest={
 guestIndex:number;
 category:"adult"|"child";
 name:string;
 email:string|null;
 phone:string|null;
 parentIndex:number|null;
};
export type DemoSelection={
 tableLabel:string;
 seatNumber:number|null;
 guestIndex:number|null;
 priceCents:number|null;
};
export type DemoTicket={
 name:string;
 quantity:number;
 admissionCents:number;
};
export type DemoBookingDraft={
 clientRequestId:string;
 eventTitle:string;
 eventSlug:string;
 currency:string;
 totalCents:number|null;
 guests:DemoGuest[];
 selections:DemoSelection[];
 tickets:DemoTicket[];
};
export type DemoBooking=DemoBookingDraft&{
 id:string;
 reference:string;
 status:"requested"|"cancelled";
 createdAt:string;
 cancelledAt:string|null;
 cancellationReason:string|null;
};

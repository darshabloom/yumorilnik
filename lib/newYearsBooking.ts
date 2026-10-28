/** One-event launch configuration; the server-side migration uses the same event ID. */
export const NEW_YEARS_2026_EVENT_ID="3f6fa4d1-aaca-4326-9c01-5774cffca2f5";
export type ChildcareDuration="3"|"6";
export const childcarePriceCents=(duration:ChildcareDuration)=>duration==="6"?6000:3000;

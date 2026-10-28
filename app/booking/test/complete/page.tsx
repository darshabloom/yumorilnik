import TestCheckoutResult from "@/components/TestCheckoutResult";
export default async function TestCheckoutComplete({
 searchParams,
}:{searchParams:Promise<{session_id?:string}>}){
 const {session_id}=await searchParams;
 return <TestCheckoutResult sessionId={session_id??""}/>;
}

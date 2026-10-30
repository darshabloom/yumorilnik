import {NextResponse} from "next/server";
export const runtime="nodejs";
export const dynamic="force-dynamic";

/** No secrets or recipient details are returned. Read-only provider preflight. */
export async function GET(){
 const key=process.env.RESEND_API_KEY;
 const from=process.env.RESEND_FROM_EMAIL??"";
 const domain=from.split("@")[1]?.toLowerCase()??"";
 if(!key||!domain||domain==="resend.dev")
  return NextResponse.json({ready:false,stage:"sender_not_configured"},{headers:{"Cache-Control":"no-store"}});
 try{
  const response=await fetch("https://api.resend.com/domains",{
   headers:{Authorization:"Bearer "+key},
   cache:"no-store",signal:AbortSignal.timeout(10000)
  });
  if(!response.ok)return NextResponse.json({ready:false,stage:"sender_api_unavailable"},
    {headers:{"Cache-Control":"no-store"}});
  const data=await response.json() as {data?:{name:string;status:string}[]};
  const verified=(data.data??[]).some(d=>d.name?.toLowerCase()===domain&&d.status==="verified");
  return NextResponse.json({ready:verified,stage:verified?"sender_verified":"domain_not_verified",
   sendingEnabled:process.env.BOOKING_EMAILS_ENABLED==="true"},
   {headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({ready:false,stage:"sender_api_unavailable"},
   {headers:{"Cache-Control":"no-store"}});}
}

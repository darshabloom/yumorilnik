import { notFound } from "next/navigation";
import BookingExperience, { type BookingEvent, type BookingTicket } from "@/components/BookingExperience";
import type { PublicTable } from "@/components/CustomerVenueMap";
import type { PriceZone } from "@/lib/priceZones";

// Browser-test fixture. The route returns 404 in production and never uses live customer data.
export default async function BookingTestPage({searchParams}:{searchParams:Promise<{scenario?:string}>}){
 if(process.env.NODE_ENV==="production")notFound();
 const {scenario="zone"}=await searchParams;
 const whole=scenario==="whole",general=scenario==="general",legacy=scenario==="legacy",unpriced=scenario==="unpriced";
 const event:BookingEvent={
   slug:"booking-test",title:"Тестовый вечер",title_en:"Test celebration",image_url:null,
   seating_mode:general?"general_admission":whole?"tables":"assigned_seats",
   table_booking_mode:whole?"whole_table":"individual_seats",
   pricing_model:legacy?"admission_plus_seat":"zone_full_seat",
   adult_seat_required:!general,child_unseated_price_cents:3000,
 };
 const tickets:BookingTicket[]=[
   {id:"adult",name:"Adult",description:null,price_cents:legacy?4000:general?4500:0,currency:"NZD",quantity_total:30,quantity_sold:0},
   {id:"child",name:"Child",description:null,price_cents:3000,currency:"NZD",quantity_total:30,quantity_sold:0},
 ];
 const tables:PublicTable[]=[
   {id:"A",label:"Table A",shape:"rect",x:230,y:260,width:190,height:100,rotation_deg:0,seats_top:4,seats_bottom:0,seats_left:0,seats_right:0,table_price_cents:20000,seat_price_cents:unpriced?null:10500,is_active:true,price_zone_id:null},
   {id:"B",label:"Table B",shape:"rect",x:550,y:260,width:150,height:90,rotation_deg:0,seats_top:2,seats_bottom:0,seats_left:0,seats_right:0,table_price_cents:12000,seat_price_cents:unpriced?null:9000,is_active:true,price_zone_id:null},
 ];
 const zones:PriceZone[]=unpriced?[]:[{
   id:"middle",event_id:"fixture",name:"Middle",price_cents:10500,color:"#f9d776",
   x:0,y:0,width:1000,height:700,sort_order:1,points:null,
 }];
 return <BookingExperience event={event} tickets={tickets} venue={{
   zones,tables,features:[],stage:{stage_x:390,stage_y:40,stage_width:220,stage_height:60,stage_rotation:0},
 }}/>;
}

import test from "node:test";
import assert from "node:assert/strict";
import {buildBookingSubmission} from "../lib/bookingSubmission.ts";
const table="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const adultType="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const childType="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const args={
 eventId:"11111111-1111-4111-8111-111111111111",
 clientRequestId:"22222222-2222-4222-8222-222222222222",
 tickets:[{id:adultType,quantity:2},{id:childType,quantity:2}],
 adultCount:2,childCount:2,wholeTable:false,
 guestInfo:{
  "0":{name:" Parent A ",email:"parenta@example.com",phone:"021111111"},
  "1":{name:"Parent B",email:"parentb@example.com",phone:"021222222"},
  "2":{name:"Child A",email:"",phone:""},
  "3":{name:"Child B",email:"",phone:""},
 },
 childParents:{"2":"0","3":"1"},
 selectedKeys:[table+":1",table+":2",table+":3"],
 seatAssignments:{[table+":1"]:"0",[table+":2"]:"1",[table+":3"]:"2"},
};

test("request contains guests and parent links, never client-provided prices",()=>{
 const payload=buildBookingSubmission(args);
 assert.deepEqual(payload.p_tickets,[{ticket_type_id:adultType,quantity:2},{ticket_type_id:childType,quantity:2}]);
 assert.deepEqual(payload.p_guests,[
  {name:"Parent A",email:"parenta@example.com",phone:"021111111"},
  {name:"Parent B",email:"parentb@example.com",phone:"021222222"},
  {name:"Child A",parent_index:0},{name:"Child B",parent_index:1},
 ]);
 assert.deepEqual(payload.p_selections,[
  {table_id:table,seat_number:1,guest_index:0},
  {table_id:table,seat_number:2,guest_index:1},
  {table_id:table,seat_number:3,guest_index:2},
 ]);
 assert.equal(JSON.stringify(payload).includes("price_cents"),false);
 assert.equal(JSON.stringify(payload).includes("37500"),false);
});
test("whole-table booking saves only whole-table ids with no seat assignees",()=>{
 const result=buildBookingSubmission({...args,wholeTable:true,selectedKeys:[table],seatAssignments:{}});
 assert.deepEqual(result.p_selections,[{table_id:table,seat_number:null,guest_index:null}]);
});
test("unselected ticket types are omitted",()=>{
 const result=buildBookingSubmission({...args,tickets:[{id:adultType,quantity:2},{id:childType,quantity:0}]});
 assert.equal(result.p_tickets.length,1);
});

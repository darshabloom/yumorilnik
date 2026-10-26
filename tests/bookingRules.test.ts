import test from "node:test";
import assert from "node:assert/strict";
import {classifyTicket,partyCounts,canStartBooking,guestDetailsValid,guestValidationProblems,reservedAdultSeats,childReservedSeats,bookingTotalCents} from "../lib/bookingRules.ts";

test("Russian and English ticket types are classified",()=>{
 assert.equal(classifyTicket("Adult"),"adult");
 assert.equal(classifyTicket("Взрослый"),"adult");
 assert.equal(classifyTicket("Child"),"child");
 assert.equal(classifyTicket("Детский"),"child");
 assert.equal(classifyTicket("VIP"),"other");
});
test("family booking requires an accompanying adult and recognised types",()=>{
 assert.deepEqual(partyCounts([{name:"Adult",quantity:2},{name:"Детский",quantity:2}]),{adults:2,children:2,other:0});
 assert.equal(canStartBooking({adults:2,children:2,other:0}),true);
 assert.equal(canStartBooking({adults:0,children:2,other:0}),false);
 assert.equal(canStartBooking({adults:1,children:0,other:1}),false);
});
const guests={"0":{name:"Parent One",email:"one@example.com",phone:"123"},"1":{name:"Parent Two",email:"two@example.com",phone:"456"},"2":{name:"Child One",email:"",phone:""},"3":{name:"Child Two",email:"",phone:""}};
test("children need named accompanying adults, not email accounts",()=>{
 assert.equal(guestDetailsValid(2,2,guests,{"2":"0","3":"1"}),true);
 assert.equal(guestDetailsValid(2,2,guests,{"2":"0","3":""}),false);
 assert.equal(guestDetailsValid(2,2,guests,{"2":"0","3":"2"}),false);
 assert.equal(guestDetailsValid(2,2,{"0":{name:"",email:"one@example.com",phone:"123"}},{}),false);
});
test("seat assignments count unique adults and optional child seats",()=>{
 const a={"tableA:1":"0","tableA:2":"1","tableA:3":"2"};
 assert.equal(reservedAdultSeats(2,a),2);
 assert.equal(childReservedSeats(2,2,a),1);
 assert.equal(reservedAdultSeats(2,{"A:1":"0","A:2":"0"}),1);
});
test("two adult seats plus two child admissions plus one extra child seat",()=>{
 assert.equal(bookingTotalCents(6000,[10500,10500,10500]),37500);
 assert.equal(bookingTotalCents(6000,[12000,9000]),27000);
 assert.equal(bookingTotalCents(6000,[10500,null]),null);
 assert.equal(bookingTotalCents(-100,[]),null);
});

test("validation identifies the exact adult or child field so customers can correct it",()=>{
 const missingEmail={...guests,"1":{...guests["1"],email:"not-an-email"}};
 assert.deepEqual(guestValidationProblems(2,2,missingEmail,{"2":"0","3":"1"}),[{guestIndex:1,field:"email"}]);
 assert.deepEqual(guestValidationProblems(2,2,guests,{"2":"0","3":""}),[{guestIndex:3,field:"parent"}]);
 assert.deepEqual(guestValidationProblems(2,2,guests,{"2":"0","3":"1"}),[]);
});

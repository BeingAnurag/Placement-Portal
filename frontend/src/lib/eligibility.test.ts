import assert from "node:assert/strict";import test from "node:test";import{evaluateEligibility,isEligible}from"./eligibility";import type{JobEligibility,StudentEligibility}from"./eligibility";
const job:JobEligibility={minCgpa:7.5,batch:2027,branches:["CSE","IT"],degrees:["B.Tech"],genders:[],maxBacklogs:0,maxBans:0};
const student:StudentEligibility={cgpa:8.2,batch:2027,branch:"CSE",degree:"B.Tech",gender:"Male",backlogs:0,bans:0,documentsComplete:true};
const check=(s:Partial<StudentEligibility>,j:Partial<JobEligibility>,key:string)=>evaluateEligibility({...student,...s},{...job,...j}).find(c=>c.key===key)?.pass;

test("eligible student passes every criterion",()=>{assert.equal(isEligible(evaluateEligibility(student,job)),true)});
test("a failed criterion makes the student ineligible",()=>{const checks=evaluateEligibility({...student,cgpa:6.9},job);assert.equal(isEligible(checks),false);assert.equal(checks.find(c=>c.key==="cgpa")?.pass,false)});
test("branch comparison is case- and whitespace-insensitive",()=>{assert.equal(check({branch:" cse "},{},"branch"),true)});
test("branch comparison still rejects a genuinely different branch",()=>{assert.equal(check({branch:"mech"},{},"branch"),false)});

test("a degree outside the allowed list is rejected",()=>{const checks=evaluateEligibility({...student,degree:"MBA"},job);assert.equal(checks.find(c=>c.key==="degree")?.pass,false);assert.equal(isEligible(checks),false)});
test("degree comparison ignores punctuation, spacing, and case",()=>{assert.equal(check({degree:"b tech"},{},"degree"),true);assert.equal(check({degree:"BTech"},{},"degree"),true);assert.equal(check({degree:"B.Tech."},{},"degree"),true)});
test("an empty degree list places no restriction",()=>{assert.equal(check({degree:"MBA"},{degrees:[]},"degree"),true);assert.equal(check({degree:null},{degrees:[]},"degree"),true)});
test("a degree list of all or any places no restriction",()=>{assert.equal(check({degree:"MBA"},{degrees:["All"]},"degree"),true);assert.equal(check({degree:null},{degrees:["any"]},"degree"),true)});
test("an unset degree fails a job that restricts degrees",()=>{assert.equal(check({degree:null},{},"degree"),false);assert.equal(check({degree:"  "},{},"degree"),false)});

test("an empty gender list places no restriction",()=>{assert.equal(check({gender:null},{},"gender"),true)});
test("a gender outside the allowed list is rejected",()=>{const checks=evaluateEligibility(student,{...job,genders:["Female"]});assert.equal(checks.find(c=>c.key==="gender")?.pass,false);assert.equal(isEligible(checks),false)});
test("gender comparison ignores case and an unset gender fails a restricted job",()=>{assert.equal(check({gender:"female"},{genders:["Female"]},"gender"),true);assert.equal(check({gender:null},{genders:["Female"]},"gender"),false)});

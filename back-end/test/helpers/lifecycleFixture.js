'use strict';
const {randomUUID}=require('node:crypto');
const {fixture:uploadFixture}=require('./uploadFixture');
function fixture(overrides={}){
  const f=uploadFixture(),calls=[];const token=randomUUID(),authorityId=randomUUID(),approvalId=randomUUID();
  const identity={assetId:'never-referenced-'+randomUUID(),publicId:'synthetic/'+randomUUID(),environment:'development',cloudName:'synthetic-cloud',displayName:'Synthetic',resourceType:'image',deliveryType:'authenticated',classification:'private',version:1,format:'png',bytes:100};
  let present=true;const request=Object.freeze({});
  const deps={enabled:true,models:f.models,clock:()=>new Date('2026-10-26T00:00:00Z'),
    resolveCandidate:async key=>key===token?{...identity}:null,
    authorizeOwner:async(req,binding)=>req===request?{...binding,authority:'project-owner',authorityId,approvalId,scope:'synthetic-only'}:null,
    verifyIsolation:async()=>true,
    verifyClearance:async binding=>({...binding,syntheticFixture:true,neverReferenced:true,historyClear:true,backupClear:true,restoreClear:true,legalHoldClear:true,retentionClear:true}),
    provider:{verifyIdentity:async b=>({...b,present}),delete:async()=>{calls.push('delete');present=false;},verifyAbsence:async(b,attemptId)=>({...b,attemptId,absent:!present})},...overrides};
  return Object.assign(f,{deps,identity,token,request,calls,get present(){return present;},setPresent:value=>{present=value;},service:require('../../services/assetLifecycle').createService(deps)});
}
module.exports={fixture};

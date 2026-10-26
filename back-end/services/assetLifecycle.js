'use strict';
const {randomUUID}=require('node:crypto');
const {asset}=require('./serviceSupport');
const {fail,model,lock,aliases}=require('../assets/referenceFence');
const keys=['assetId','publicId','environment','displayName','resourceType','deliveryType','classification','format','version','bytes','cloudName'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const same=(proof,binding)=>proof&&Object.entries(binding).every(([k,v])=>proof[k]===v);
const receipt=c=>Object.freeze({id:c.key,state:c.state,reason:c.reason});
function createService(deps={}){
  const {models,clock=()=>new Date()}=deps;
  let connection,M;
  const time=()=>{const t=clock();if(!(t instanceof Date)||!Number.isFinite(t.getTime()))fail();return t;};
  const id=value=>{if(typeof value!=='string'||!uuid.test(value))fail();return value;};
  function identity(input){
    if(!input||Object.keys(input).sort().join('|')!==[...keys].sort().join('|'))fail();
    const {cloudName,...value}=input;asset(value,true);
    if(!['development','preview','production'].includes(value.environment)||typeof cloudName!=='string'||!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(cloudName))fail();
    if([value.assetId,value.publicId,value.displayName].some(v=>v.length>255||/[\r\n]/.test(v)))fail();
    return Object.freeze({...value,cloudName});
  }
  const binding=c=>identity(Object.fromEntries(keys.map(k=>[k,k==='cloudName'?c.cloudName:c.asset[k]])));
  async function ready(){
    if(deps.enabled!==true||!models||['authorizeOwner','resolveCandidate','verifyIsolation','verifyClearance'].some(k=>typeof deps[k]!=='function'))fail();
    connection=models.User?.db;
    // This phase has no operational execution mode, even when an application environment is configured.
    if(connection?.name!=='teachable_21b_bc3e0f91742f90ce056b'||connection.getClient()?.options.tls!==true||connection.getClient()?.options.srvHost!=='teachable-testing.ntguusj.mongodb.net')fail();
    for(const name of ['User','Course','Material'])if(models[name]?.db!==connection||models[name].schema!==require('../models/'+name)||models[name].collection.name!==models[name].schema.options.collection)fail();
    const I=connection.models.UploadIntent;
    if(!I||I.schema!==require('../models/UploadIntent')||I.collection.name!=='uploadIntents')fail();
    if(await deps.verifyIsolation(connection)!==true)fail();M=model(connection);
  }
  async function authority(request,operation,caseId,value,previous){
    const scope={operation,caseId,...value};const proof=await deps.authorizeOwner(request,Object.freeze(scope));
    if(!same(proof,scope)||proof.authority!=='project-owner'||proof.scope!=='synthetic-only'||!uuid.test(proof.authorityId)||!uuid.test(proof.approvalId))fail();
    if(previous&&(proof.authorityId!==previous.authorityId||proof.approvalId!==previous.approvalId))fail();
    return {authorityId:proof.authorityId,approvalId:proof.approvalId};
  }
  async function clearance(value){
    const proof=await deps.verifyClearance(value);
    return same(proof,value)&&['syntheticFixture','neverReferenced','historyClear','backupClear','restoreClear','legalHoldClear','retentionClear'].every(k=>proof[k]===true);
  }
  async function tx(owner,work){
    const session=await connection.startSession();
    try{return await session.withTransaction(async()=>{const guard=await lock(connection,session,owner);return work(session,guard);},{readConcern:{level:'snapshot'},writeConcern:{w:'majority'},readPreference:'primary',timeoutMS:15000,maxCommitTimeMS:5000});}
    finally{await session.endSession();}
  }
  async function load(caseId,session){const c=await M.findOne({key:id(caseId),kind:'case'}).session(session).maxTimeMS(5000);if(!c)fail();return c;}
  function transition(c,state,reason){
    if(c.events.length>=16)fail();const at=time();if(c.events.length&&at<c.events.at(-1).at)fail();
    c.state=state;c.reason=reason;c.events.push({state,reason,at,correlation:randomUUID()});
  }
  async function referenced(value,session){
    for(const [name,path] of [['User','profileImage.'],['Course','coverImage.'],['Material','asset.']]){
      // Existence queries examine all matching records, including removed/archived rows; timeout is unresolved.
      if(await models[name].findOne({$or:aliases(value,path)}).session(session).maxTimeMS(5000))return true;
    }
    const I=connection.models.UploadIntent;
    if(await I.findOne({$or:[...aliases(value,'asset.'),...aliases(value,'previousAsset.'),{publicId:value.publicId,environment:value.environment}]}).session(session).maxTimeMS(5000))return true;
    return false;
  }
  async function eligible(value,session){
    if(await referenced(value,session))return 'referenced';
    if(!await clearance(value))return 'unresolved';
    return 'clear';
  }
  async function uncertain(caseId){
    return tx(caseId,async(session)=>{const c=await load(caseId,session);if(c.state==='deletion-pending'){transition(c,'uncertain','uncertain');await c.save({session});}return receipt(c);});
  }
  async function check(caseId,request,operation,requirePending=false){
    return tx(caseId,async(session,guard)=>{
      const c=await load(caseId,session),value=binding(c);
      await authority(request,operation,caseId,value,c);
      if(requirePending&&(!['deletion-pending','uncertain'].includes(c.state)||guard.pendingCase!==caseId))fail();
      if(await eligible(value,session)!=='clear')fail();
      return {value,attemptId:c.attemptId,state:c.state};
    });
  }
  async function absence(caseId,request,signal){
    const checked=await check(caseId,request,'reconcile',true);
    const proof=await deps.provider.verifyAbsence(checked.value,checked.attemptId,signal);
    if(signal.aborted||!same(proof,checked.value)||proof.attemptId!==checked.attemptId||proof.absent!==true)fail();
    return tx(caseId,async(session,guard)=>{
      const c=await load(caseId,session),value=binding(c);
      if(guard.pendingCase!==caseId||c.attemptId!==checked.attemptId||!['deletion-pending','uncertain'].includes(c.state)||signal.aborted)fail();
      await authority(request,'reconcile',caseId,value,c);
      if(await eligible(value,session)!=='clear'||signal.aborted)fail();
      transition(c,'deletion-verified','absence-verified');await c.save({session});guard.pendingCase=undefined;await guard.save({session});return receipt(c);
    });
  }
  let active=0;
  async function bounded(work){
    if(active>=2)fail();active++;const controller=new AbortController();let timer;
    const pending=Promise.resolve().then(()=>work(controller.signal)).finally(()=>{active--;clearTimeout(timer);});
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();try{fail();}catch(e){reject(e);}},5000);});
    return Promise.race([pending,timeout]);
  }
  function provider(){if(!deps.provider||['verifyIdentity','delete','verifyAbsence'].some(k=>typeof deps.provider[k]!=='function'))fail();}
  async function guarded(work){try{return await work();}catch{fail();}}
  const api={
    assess:(token,request)=>guarded(async()=>{
      await ready();id(token);const caseId=randomUUID();
      // Resolve an opaque trusted inventory key; callers cannot submit provider identifiers.
      await authority(request,'resolve',caseId,{});
      const value=identity(await deps.resolveCandidate(token));await authority(request,'assess',caseId,value);
      return tx(undefined,async(session)=>{
        const reason=await eligible(value,session);
        const previous=await M.findOne({kind:'case',$or:aliases(value)}).session(session).maxTimeMS(5000);
        if(previous){
          const stored=binding(previous);if(!same(value,stored))fail();await authority(request,'assess',previous.key,stored);
          if(['held','candidate'].includes(previous.state)){const state=reason==='clear'?'candidate':'held';if(previous.state!==state||previous.reason!==reason){transition(previous,state,reason);await previous.save({session});}}
          return receipt(previous);
        }
        const {cloudName,...stored}=value,c=new M({key:caseId,kind:'case',asset:stored,cloudName});
        transition(c,reason==='clear'?'candidate':'held',reason);await c.save({session});return receipt(c);
      });
    }),
    inspect:(caseId,request)=>guarded(async()=>{await ready();return tx(caseId,async session=>{const c=await load(caseId,session);await authority(request,'inspect',caseId,binding(c));return Object.freeze({...receipt(c),identity:binding(c),authorityId:c.authorityId,approvalId:c.approvalId,attemptId:c.attemptId,events:Object.freeze(c.events.map(e=>Object.freeze({state:e.state,reason:e.reason,at:e.at.toISOString(),correlation:e.correlation})))});});}),
    approve:(caseId,request)=>guarded(async()=>{
      await ready();return tx(undefined,async(session)=>{
        const c=await load(caseId,session),value=binding(c);if(c.state!=='candidate')fail();
        const proof=await authority(request,'approve',caseId,value);const reason=await eligible(value,session);
        if(reason==='clear'){Object.assign(c,proof);transition(c,'approved','approved');}else transition(c,'held',reason);
        await c.save({session});return receipt(c);
      });
    }),
    execute:(caseId,request)=>guarded(async()=>{
      await ready();provider();id(caseId);
      const claimed=await tx(caseId,async(session,guard)=>{
        const c=await load(caseId,session),value=binding(c);await authority(request,'execute',caseId,value,c);
        if(['deletion-pending','uncertain','deletion-verified'].includes(c.state))return {done:receipt(c)};
        if(c.state!=='approved')fail();
        if(await eligible(value,session)!=='clear'){transition(c,'held','unresolved');await c.save({session});return {done:receipt(c)};}
        c.attemptId=randomUUID();transition(c,'deletion-pending','dispatch');guard.pendingCase=caseId;
        await guard.save({session});await c.save({session});return {value,attemptId:c.attemptId};
      });
      // Only a known committed dispatch result can reach the provider; retries read the durable pending state.
      if(claimed.done)return claimed.done;
      try{return await bounded(async signal=>{
        const verified=await deps.provider.verifyIdentity(claimed.value,signal);
        if(signal.aborted||!same(verified,claimed.value)||verified.present!==true)fail();
        const current=await check(caseId,request,'execute',true);
        if(signal.aborted||current.attemptId!==claimed.attemptId)fail();
        await deps.provider.delete(current.value,current.attemptId,signal);
        if(signal.aborted)fail();
        return absence(caseId,request,signal);
      });}catch{return uncertain(caseId);}
    }),
    reconcile:(caseId,request)=>guarded(async()=>{
      await ready();provider();id(caseId);
      const c=await tx(caseId,async session=>{const record=await load(caseId,session);await authority(request,'reconcile',caseId,binding(record),record);return receipt(record);});
      if(c.state==='deletion-verified')return c;
      try{return await bounded(signal=>absence(caseId,request,signal));}catch{return uncertain(caseId);}
    })
  };
  return Object.freeze(api);
}
module.exports={createService};

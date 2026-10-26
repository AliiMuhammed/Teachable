'use strict';
const { Schema } = require('mongoose');
const { text, integer, date, schemaFor } = require('./validation');
const assetSchema = require('./assetSchema');
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const token = extra => text({required:false,validate:v=>uuid.test(v),...extra});
const states=['candidate','held','approved','deletion-pending','uncertain','deletion-verified'];
const reasons=['unassessed','referenced','unresolved','clear','approved','dispatch','uncertain','absence-verified'];
const eventSchema=new Schema({state:text({enum:states}),reason:text({enum:reasons}),at:date(),correlation:token({required:true})},{_id:false,strict:'throw'});
const schema=schemaFor('assetLifecycles',{
  key:text({immutable:true,maxlength:80}),kind:text({immutable:true,enum:['guard','case']}),
  revision:integer(0,{default:0}),pendingCase:token(),
  asset:{type:assetSchema,immutable:true},cloudName:text({required:false,immutable:true,maxlength:128}),
  state:text({required:false,enum:states}),reason:text({required:false,enum:reasons}),
  authorityId:token(),approvalId:token(),attemptId:token(),
  events:{type:[eventSchema],default:[],validate:v=>v.length<=16}
},false);
schema.index({key:1},{unique:true});
const audit = events => events.map(e=>JSON.stringify([e.state,e.reason,+e.at,e.correlation]));
function remember(doc){doc.$locals.lifecycleSnapshot={state:doc.state,events:audit(doc.events)};}
schema.post('init',remember);
schema.post('save',remember);

schema.pre('validate',function(){
  if(!this.isNew&&this.isModified('asset'))this.invalidate('asset','Persisted identity is immutable');
  const prior=this.$locals.lifecycleSnapshot;
  if(prior&&this.kind==='case'){
    const allowed={candidate:['held','approved'],held:['candidate'],approved:['held','deletion-pending'],'deletion-pending':['uncertain','deletion-verified'],uncertain:['deletion-verified'],'deletion-verified':[]};
    if(prior.state!==this.state&&!allowed[prior.state]?.includes(this.state))this.invalidate('state','Invalid lifecycle transition');
    const current=audit(this.events);
    if(prior.events.some((event,index)=>event!==current[index]))this.invalidate('events','Audit evidence is append-only');
  }

  if(this.kind==='guard'){
    if(this.key!=='reference-fence'||this.asset||this.cloudName||this.state||this.reason||this.authorityId||this.approvalId||this.attemptId||this.events.length)this.invalidate('kind','Invalid guard');
  }else if(!uuid.test(this.key)||!this.asset||!this.cloudName||!this.state||!this.reason||!this.events.length||this.pendingCase||this.asset.classification!=='private'||this.asset.deliveryType!=='authenticated')this.invalidate('kind','Invalid case');
  if(['approved','deletion-pending','uncertain','deletion-verified'].includes(this.state)&&(!this.authorityId||!this.approvalId))this.invalidate('approvalId','Approval required');
  if(['deletion-pending','uncertain','deletion-verified'].includes(this.state)&&!this.attemptId)this.invalidate('attemptId','Attempt required');
});
for(const op of ['deleteOne','deleteMany','findOneAndDelete'])schema.pre(op,{document:true,query:true},function(){throw new Error('Lifecycle deletion is not supported');});
schema.pre('insertMany',function(){throw new Error('Lifecycle bulk insertion is not supported');});
module.exports=schema;

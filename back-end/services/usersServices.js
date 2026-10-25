'use strict';
const { support, expose, fail, fields, text, email, asset, userDTO, profile } = require('./serviceSupport');
function createService(dependencies) {
  const { run } = support(dependencies);
  return Object.freeze({
    getUserById: (id, context) => run(context, s => profile(s,id)),
    getUser: (value, context) => run(context, async s => {
      s.role('admin'); const key=email(value);
      return userDTO(await s.required('User', { emailKey: key }));
    }),
    insertUser: (data, context) => run(context, async s => {
      s.role('admin');
      const keys=['name','email','phone','passwordHash','role','accountState','profileImage']; fields(data,keys,keys);
      text(data.name,255); email(data.email); text(data.phone); text(data.passwordHash);
      if (!['student','instructor'].includes(data.role) || !['pending','active','disabled'].includes(data.accountState)) fail('INVALID_INPUT');
      const image=asset(data.profileImage,true);
      const doc=await s.validate('User',{ ...data,profileImage:image,id:1 });
      await s.verify(image,'profile'); await s.lockActor();
      doc.id=await s.allocate('users'); await doc.save({ session:s.session }); return userDTO(doc);
    }),
    updateStatus: async () => fail('WORKFLOW_REQUIRED')
  });
}
module.exports=expose(createService,['getUserById','insertUser','getUser','updateStatus']);

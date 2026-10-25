'use strict';
const multer = require('multer');
const { fail, id, fields, text } = require('../services/serviceSupport');

const errors = Object.freeze({
  AUTH_UNAVAILABLE: [503, 'Server authentication is not configured'],
  TRUST_REQUIRED: [401, 'Verified authentication required'], DENIED: [403, 'Operation denied'],
  INVALID_INPUT: [400, 'Invalid request'], NOT_FOUND: [404, 'Record not found'],
  CONFLICT: [409, 'Operation conflicts with current data'],
  WORKFLOW_REQUIRED: [503, 'Required secure workflow is unavailable'],
  ASSET_UNVERIFIED: [503, 'Verified asset delivery is unavailable'],
  COUNTER_UNVERIFIED: [503, 'Verified counter initialization required'],
  INDEX_UNVERIFIED: [503, 'Required database indexes unavailable'],
  RETENTION_REQUIRED: [503, 'Verified retention clearance required'],
  LIMIT_EXCEEDED: [422, 'Result exceeds the supported list bound'],
  UNAVAILABLE: [503, 'Database operation unavailable; outcome may require reconciliation'],
  RETRY_EXHAUSTED: [503, 'Transaction retry limit reached'],
  PAYLOAD_TOO_LARGE: [413, 'Request too large'], INTERNAL: [500, 'Internal Server Error']
});
function respondError(res, code) {
  const [status, message] = errors[code];
  return res.status(status).json({ errors: message, code });
}
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let code = error?.name === 'ServiceError' && Object.hasOwn(errors, error.code) ? error.code : 'INTERNAL';
  if (['entity.too.large', 'parameters.too.many'].includes(error?.type)) code = 'PAYLOAD_TOO_LARGE';
  else if (error?.type === 'entity.parse.failed' || error instanceof URIError || error instanceof multer.MulterError) code = 'INVALID_INPUT';
  return respondError(res, code);
}
function numeric(value, zero = false) {
  if (typeof value === 'string') {
    if (!/^(0|[1-9][0-9]*)$/.test(value)) fail('INVALID_INPUT');
    value = Number(value);
  }
  if (zero && value === 0) return 0;
  return id(value);
}
function body(req, allowed, required = []) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) fail('INVALID_INPUT');
  return fields({ ...req.body }, allowed, required);
}
function createController(dependencies = {}) {
  const { authorizeRequest, resolveAssetUrl } = dependencies;
  const services = Object.fromEntries(['courses', 'student', 'instructor', 'materials'].map(name =>
    [name, require(`../services/${name}Services`).createService(dependencies)]));
  const parseForm = multer({ limits: { fieldSize: 65536, fields: 8, parts: 8, files: 0 } }).none();
  function handler(work, publicRead = false) {
    return async (req, res, next) => {
      try {
        if (!publicRead && typeof authorizeRequest !== 'function') return respondError(res, 'AUTH_UNAVAILABLE');
        // This server-owned callback must verify sessions and mutation CSRF, never request identity claims.
        const context = typeof authorizeRequest === 'function' ? await authorizeRequest(req) : undefined;
        if (!publicRead && context == null) fail('TRUST_REQUIRED');
        if (req.is('multipart/form-data')) {
          try {
            await new Promise((resolve, reject) => parseForm(req, res, error => error ? reject(error) : resolve()));
          } catch { fail('INVALID_INPUT'); }
        }
        return await work(req, res, context);
      } catch (error) { next(error); }
    };
  }
  async function assetUrl(kind, target, context) {
    if (typeof resolveAssetUrl !== 'function') fail('ASSET_UNVERIFIED');
    // The resolver owns current resource authorization, asset proof and private expiry/revocation.
    const value = await resolveAssetUrl(Object.freeze({ kind, id: target }), context);
    if (typeof value !== 'string' || value.length > 8192 || /\s/.test(value)) fail('ASSET_UNVERIFIED');
    let url;
    try { url = new URL(value); } catch { fail('ASSET_UNVERIFIED'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) fail('ASSET_UNVERIFIED');
    return value;
  }
  async function courseDTO(d, context) {
    return { id: d.id, name: d.name, code: d.code, description: d.description, durations: d.durations,
      status: d.lifecycle === 'published' ? 1 : 0, image_url: await assetUrl('course', d.id, context) };
  }
  async function userDTO(d, context) {
    return { id: d.id, name: d.name, email: d.email, phone: d.phone,
      type: d.role === 'instructor' ? 'instractor' : d.role, accountState: d.accountState,
      image_url: await assetUrl('profile', d.id, context) };
  }
  async function mapRows(rows, map, context) {
    const result = [];
    for (const row of rows) result.push(await map(row, context));
    return result;
  }
  const unavailable = handler(async () => fail('WORKFLOW_REQUIRED'));
  const controller = {
    authUnavailable: (req, res) => respondError(res, 'WORKFLOW_REQUIRED'),
    addCourse: unavailable, addMaterial: unavailable,
    deleteStudent: unavailable, deleteInstructor: unavailable,
    getCourses: handler(async (req, res, context) => {
      fields({ ...req.query }, ['search']);
      const rows = Object.hasOwn(req.query, 'search')
        ? await services.courses.searchCourses({ text: text(req.query.search, 200, true) }, context)
        : await services.courses.showcourses(context);
      res.json(await mapRows(rows, courseDTO, context));
    }, true),
    getCourse: handler(async (req, res, context) => {
      res.json(await courseDTO(await services.courses.getCourse(numeric(req.params.id), context), context));
    }, true),
    updateCourse: handler(async (req, res, context) => {
      const data = body(req, ['name', 'code', 'description', 'durations', 'status']);
      // T21-04 approves a forward DTO mapping, not a reverse legacy state transition.
      if (Object.hasOwn(data, 'status')) fail('WORKFLOW_REQUIRED');
      await services.courses.updateCourse(data, numeric(req.params.id), context);
      res.json({ msg: 'Course updated' });
    }),
    deleteCourse: handler(async (req, res, context) => {
      body(req, []);
      await services.courses.deleteCourse(numeric(req.params.id), context);
      res.json({ msg: 'Course Delete Success' });
    }),
    assignCourse: handler(async (req, res, context) => {
      const data = body(req, ['courseId', 'instructorId'], ['courseId', 'instructorId']);
      await services.instructor.assgin({ courseId: numeric(data.courseId), instructorId: numeric(data.instructorId) }, context);
      res.json({ msg: 'instructor Assign successfully' });
    }),
    getRelatedCourses: handler(async (req, res, context) => {
      const rows = await services.instructor.showRelatedCourses(numeric(req.params.id), context);
      if (!rows.length) return res.status(400).json({ errors: ["You haven't been assigned to any courses."] });
      res.json(await mapRows(rows, courseDTO, context));
    }),
    viewStudents: handler(async (req, res, context) => {
      const rows = await services.student.viewStudents(numeric(req.params.id), context);
      res.json(rows.map(d => ({ id: d.id, name: d.name, ide: d.enrollmentId, grades: d.grade })));
    }),
    setGrades: handler(async (req, res, context) => {
      const data = body(req, ['grades'], ['grades']);
      const grade = data.grades === null ? null : numeric(data.grades, true);
      await services.instructor.setGrades(grade, numeric(req.params.studentId), numeric(req.params.courseId), context);
      res.json({ msg: 'Grades Added' });
    }),
    enrollment: handler(async (req, res, context) => {
      body(req, []);
      await services.student.enrollment({ studentId: numeric(req.params.student_id), courseId: numeric(req.params.course_id) }, context);
      res.json({ msg: 'Course registered successfully' });
    }),
    checkEnrollment: handler(async (req, res, context) => {
      res.json((await services.student.checkEnrollment(numeric(req.params.studentId), numeric(req.params.courseId), context)) === null);
    }),
    showGrade: handler(async (req, res, context) => {
      const rows = await services.student.showGrade(numeric(req.params.id), context);
      if (!rows.length) return res.status(404).json({ msg: 'not found' });
      const result = [];
      for (const d of rows) result.push({ id: d.course.id, name: d.course.name, code: d.course.code,
        durations: d.course.durations, image_url: await assetUrl('course', d.course.id, context), grades: d.grade });
      res.json(result);
    }),
    getMaterials: handler(async (req, res, context) => {
      const rows = await services.materials.getMaterials(numeric(req.params.course_id), context);
      if (!rows.length) return res.status(404).json({ msg: 'Not Found' });
      const result = [];
      for (const d of rows) result.push({ id: d.id, name: d.name, course_id: d.courseId, fileName: await assetUrl('material', d.id, context) });
      res.json(result);
    }),
    updateMaterial: handler(async (req, res, context) => {
      await services.materials.updateMaterials(body(req, ['name'], ['name']), numeric(req.params.id), context);
      res.json({ msg: 'Material updated' });
    }),
    deleteMaterials: handler(async (req, res, context) => {
      body(req, []);
      await services.materials.deleteMaterials(numeric(req.params.id), context);
      res.json({ msg: 'Material Delete Success' });
    })
  };
  for (const [name, service, empty] of [['Student', services.student, 'no Students found'], ['Instructor', services.instructor, 'no instructors found']]) {
    controller[`get${name}`] = handler(async (req, res, context) => {
      res.json(await userDTO(await service[`get${name}`](numeric(req.params.id), context), context));
    });
    controller[`get${name}s`] = handler(async (req, res, context) => {
      const rows = await service[`show${name}s`](context);
      if (!rows.length) return res.status(404).json({ msg: empty });
      res.json(await mapRows(rows, userDTO, context));
    });
    controller[`update${name}`] = handler(async (req, res, context) => {
      await service[`update${name}`](body(req, ['name', 'phone']), numeric(req.params.id), context);
      res.json({ msg: `${name} updated` });
    });
  }
  return controller;
}
module.exports = { createController, errorHandler, respondError };

const courseServices = require("../services/coursesServices");
const instructorServices = require("../services/instructorServices");

exports.assignCourse = async (req, res) => {
  try {
    const course = await courseServices.getCourse(req.body.courseId);
    if (!course[0]) {
      return res.status(400).json({ errors: ["Course not found"] });
    }

    const instructor = await instructorServices.getInstructor(
      req.body.instructorId
    );
    if (!instructor[0] || instructor[0].type != "instractor") {
      return res.status(400).json({ errors: ["Instructor Not Found"] });
    }

    const assignObj = {
      instractor_id: instructor[0].id,
      course_id: course[0].id,
    };

    const assign = await instructorServices.checkAssign(
      instructor[0].id,
      course[0].id
    );
    if (assign.length > 0) {
      return res.status(400).json({
        errors: [
          {
            msg: "Insturctor already assigned",
          },
        ],
      });
    }
    await instructorServices.assgin(assignObj);
    res.status(200).json({
      msg: "instructor Assign successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ errors: "Internal Server Error" });
  }
};

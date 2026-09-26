const express = require("express")
const authMiddleware = require("../middlewares/auth.middleware")
const interviewController = require("../controllers/interview.controller")
const upload = require("../middlewares/file.middleware")

const interviewRouter = express.Router()

/* mock interview endpoints */
const mockController = require("../controllers/mock.controller")

/**
 * Start mock interview: POST /api/interview/mock/start { interviewReportId }
 */
interviewRouter.post('/mock/start', authMiddleware.authUser, mockController.startMockInterviewController)

/**
 * Submit answer: POST /api/interview/mock/:sessionId/answer { answer }
 */
interviewRouter.post('/mock/:sessionId/answer', authMiddleware.authUser, mockController.submitMockAnswerController)

/**
 * Get session status: GET /api/interview/mock/:sessionId
 */
interviewRouter.get('/mock/:sessionId', authMiddleware.authUser, mockController.getMockSessionStatusController)



/**
 * @route POST /api/interview/
 * @description generate new interview report on the basis of user self description,resume pdf and job description.
 * @access private
 */
interviewRouter.post("/", authMiddleware.authUser, upload.single("resume"), interviewController.generateInterViewReportController)

/**
 * @route GET /api/interview/report/:interviewId
 * @description get interview report by interviewId.
 * @access private
 */
interviewRouter.get("/report/:interviewId", authMiddleware.authUser, interviewController.getInterviewReportByIdController)

/**
 * @route DELETE /api/interview/report/:interviewId
 * @description delete interview report by interviewId
 * @access private
 */
interviewRouter.delete("/report/:interviewId", authMiddleware.authUser, interviewController.deleteInterviewReportController)


/**
 * @route GET /api/interview/
 * @description get all interview reports of logged in user.
 * @access private
 */
interviewRouter.get("/", authMiddleware.authUser, interviewController.getAllInterviewReportsController)


/**
 * @route GET /api/interview/resume/pdf
 * @description generate resume pdf on the basis of user self description, resume content and job description.
 * @access private
 */
interviewRouter.post("/resume/pdf/:interviewReportId", authMiddleware.authUser, interviewController.generateResumePdfController)



module.exports = interviewRouter
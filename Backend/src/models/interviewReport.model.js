const { createInMemoryModel } = require("../config/inMemoryStore")

const interviewReportModel = createInMemoryModel("InterviewReport")

module.exports = interviewReportModel;  
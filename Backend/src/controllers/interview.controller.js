const { PDFParse } = require("pdf-parse")
const mammoth = require("mammoth")
const { generateInterviewReport, generateResumePdf } = require("../services/ai.service")
const interviewReportModel = require("../models/interviewReport.model")

async function extractResumeText(file) {
    if (!file || !file.buffer) {
        throw new Error("Resume file is required.")
    }

    const fileName = (file.originalname || "").toLowerCase()

    if (fileName.endsWith(".pdf")) {
        if (typeof PDFParse !== "function") {
            throw new Error("PDF resume parsing is not available.")
        }

        const parser = new PDFParse({ data: file.buffer })
        const resumeDocument = await parser.getText()
        return resumeDocument?.text || ""
    }

    if (fileName.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer: file.buffer })
        return result?.value || ""
    }

    throw new Error("Unsupported resume format. Please upload a PDF or DOCX file.")
}

/**
 * @description Controller to generate interview report based on user self description, resume and job description.
 */
async function generateInterViewReportController(req, res) {

    try {
        const { selfDescription, jobDescription } = req.body
        const resumeText = await extractResumeText(req.file)

        const interViewReportByAi = await generateInterviewReport({
            resume: resumeText,
            selfDescription,
            jobDescription
        })

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeText,
            selfDescription,
            jobDescription,
            ...interViewReportByAi
        })

        res.status(201).json({
            message: "Interview report generated successfully.",
            interviewReport
        })
    } catch (error) {
        res.status(400).json({
            message: error.message || "Unable to process the uploaded resume."
        })
    }

}

/**
 * @description Controller to get interview report by interviewId.
 */
async function getInterviewReportByIdController(req, res) {

    const { interviewId } = req.params

    const interviewReport = await interviewReportModel.findOne({ _id: interviewId, user: req.user.id })

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    res.status(200).json({
        message: "Interview report fetched successfully.",
        interviewReport
    })
}


/** 
 * @description Controller to get all interview reports of logged in user.
 */
async function getAllInterviewReportsController(req, res) {
    const interviewReports = await interviewReportModel.find({ user: req.user.id }).sort({ createdAt: -1 }).select("-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan")

    res.status(200).json({
        message: "Interview reports fetched successfully.",
        interviewReports
    })
}


/**
 * @description Controller to generate resume PDF based on user self description, resume and job description.
 */
async function generateResumePdfController(req, res) {
    const { interviewReportId } = req.params

    const interviewReport = await interviewReportModel.findById(interviewReportId)

    if (!interviewReport) {
        return res.status(404).json({
            message: "Interview report not found."
        })
    }

    const { resume, jobDescription, selfDescription } = interviewReport

    const pdfBuffer = await generateResumePdf({ resume, jobDescription, selfDescription })

    res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=resume_${interviewReportId}.pdf`
    })

    res.send(pdfBuffer)
}

async function deleteInterviewReportController(req, res) {
    const { interviewId } = req.params

    try {
        const deleted = await interviewReportModel.findOneAndDelete({ _id: interviewId, user: req.user.id })

        if (!deleted) {
            return res.status(404).json({ message: 'Interview report not found or not authorized.' })
        }

        return res.status(200).json({ message: 'Interview report deleted successfully.', interviewId })
    } catch (err) {
        console.error('Error deleting interview report', err)
        return res.status(500).json({ message: 'Unable to delete interview report.' })
    }
}

module.exports = { generateInterViewReportController, getInterviewReportByIdController, getAllInterviewReportsController, generateResumePdfController, deleteInterviewReportController }
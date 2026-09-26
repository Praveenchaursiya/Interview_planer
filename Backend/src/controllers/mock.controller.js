const { createInMemoryModel } = require("../config/inMemoryStore")
const interviewReportModel = require("../models/interviewReport.model")
const mockSessionModel = createInMemoryModel("MockInterview")
const aiService = require("../services/ai.service")

/**
 * Start a mock interview session for an existing interview report
 * Creates a session with questions and returns session id
 */
async function startMockInterviewController(req, res) {
    const { interviewReportId } = req.body

    const interviewReport = await interviewReportModel.findById(interviewReportId)
    if (!interviewReport) {
        return res.status(404).json({ message: "Interview report not found." })
    }

    // combine technical and behavioral questions
    const questions = [
        ...(interviewReport.technicalQuestions || []).map((q) => ({
            type: "technical",
            question: q.question,
            modelAnswer: q.answer
        })),
        ...(interviewReport.behavioralQuestions || []).map((q) => ({
            type: "behavioral",
            question: q.question,
            modelAnswer: q.answer
        }))
    ]

    const session = await mockSessionModel.create({
        user: req.user.id,
        interviewReportId,
        questions,
        currentIndex: 0,
        answers: [],
        scores: [],
        completed: false
    })

    res.status(201).json({ message: "Mock interview started.", sessionId: session._id, questionsCount: questions.length })
}

/**
 * Submit an answer for current question and receive AI feedback and score
 */
async function submitMockAnswerController(req, res) {
    const { sessionId } = req.params
    const { answer } = req.body

    const session = await mockSessionModel.findById(sessionId)
    if (!session) {
        return res.status(404).json({ message: "Session not found." })
    }

    if (session.completed) {
        return res.status(400).json({ message: "Session already completed." })
    }

    const currentIndex = session.currentIndex || 0
    const questionObj = session.questions[currentIndex]
    if (!questionObj) {
        return res.status(400).json({ message: "No question available." })
    }

    // Score the answer using AI service
    try {
        const scoring = await aiService.scoreAnswer({
            question: questionObj.question,
            modelAnswer: questionObj.modelAnswer,
            userAnswer: answer
        })

        // update session
        session.answers.push({ question: questionObj.question, answer })
        session.scores.push({ score: scoring.score, feedback: scoring.feedback })
        session.currentIndex = currentIndex + 1
        if (session.currentIndex >= session.questions.length) {
            session.completed = true
        }

        // save by creating a new doc (in-memory store doesn't update in place), so mimic update
        await mockSessionModel.create({
            ...session,
            _id: session._id,
            updatedAt: new Date()
        })

        res.status(200).json({
            message: "Answer submitted.",
            score: scoring.score,
            feedback: scoring.feedback,
            completed: session.completed,
            nextIndex: session.currentIndex
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ message: "Failed to score answer." })
    }
}

/**
 * Get the current status of a mock session
 */
async function getMockSessionStatusController(req, res) {
    const { sessionId } = req.params
    const session = await mockSessionModel.findById(sessionId)
    if (!session) {
        return res.status(404).json({ message: "Session not found." })
    }

    const currentQuestion = session.questions[session.currentIndex] || null
    const avgScore = session.scores && session.scores.length ? Math.round(session.scores.reduce((s, x) => s + (x.score || 0), 0) / session.scores.length) : 0

    res.status(200).json({
        sessionId: session._id,
        interviewReportId: session.interviewReportId,
        currentIndex: session.currentIndex,
        totalQuestions: session.questions.length,
        currentQuestion: currentQuestion ? { question: currentQuestion.question, type: currentQuestion.type } : null,
        completed: session.completed,
        answers: session.answers || [],
        scores: session.scores || [],
        averageScore: avgScore
    })
}

module.exports = { startMockInterviewController, submitMockAnswerController, getMockSessionStatusController }
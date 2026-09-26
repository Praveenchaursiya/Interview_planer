const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
const fallbackModels = [
    process.env.GEMINI_MODEL,
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.6-flash"
].filter(Boolean)

const ai = new GoogleGenAI({
    apiKey
})

// Sleep helper used between model retries to give overloaded Gemini instances
// a chance to recover.
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

// Treat 503/UNAVAILABLE/429/RESOURCE_EXHAUSTED as transient so we fall back
// to the next model instead of surfacing the error to the caller.
function isTransientError(message) {
    if (!message) return false
    return /UNAVAILABLE|503|429|RESOURCE_EXHAUSTED|high demand|temporarily|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN/i.test(
        message
    )
}

async function generateContentWithFallback(config, { maxRetriesPerModel = 2 } = {}) {
    let lastError = null

    for (const model of fallbackModels) {
        for (let attempt = 1; attempt <= maxRetriesPerModel; attempt++) {
            try {
                return await ai.models.generateContent({
                    ...config,
                    model
                })
            } catch (error) {
                lastError = error
                const message = error?.message || ""
                const transient = isTransientError(message) || error?.status === 503 || error?.status === 429

                if (!transient) {
                    // Non-recoverable (bad prompt, schema mismatch, etc.) - try next model
                    break
                }

                if (attempt < maxRetriesPerModel) {
                    // Exponential backoff before retrying the same model
                    await sleep(500 * attempt)
                }
            }
        }

        // Brief pause before moving to the next model
        await sleep(250)
    }

    throw lastError || new Error("No Gemini model was available for this request.")
}


const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job describe"),
    summary: z.string().describe("A concise executive summary of the candidate's readiness, strengths, and overall interview outlook"),
    strengths: z.array(z.string()).describe("Top strengths and differentiators in the candidate profile that align with the role"),
    focusAreas: z.array(z.string()).describe("Primary focus areas or skill gaps that deserve attention before the interview"),
    recommendedNextSteps: z.array(z.string()).describe("Actionable next steps the candidate should take to improve interview performance and role fit"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The technical question can be asked in the interview"),
        intention: z.string().describe("The intention of interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum([ "low", "medium", "high" ]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),
    title: z.string().describe("The title of the job for which the interview report is generated"),
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {


    const prompt = `Generate an interview report for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

Produce a highly actionable interview readiness report. Include:
- summary: a short executive summary of candidate readiness
- strengths: 4-6 strongest relevant strengths for the role
- focusAreas: 3-5 major focus areas to improve
- recommendedNextSteps: 4-6 practical actions with timing or sequence
- matchScore: a realistic percentage from 0 to 100
- technicalQuestions: tailored questions with intention and model answer
- behavioralQuestions: tailored questions with intention and model answer
- skillGaps: important missing skills with severity levels
- preparationPlan: a step-by-step preparation plan for the next couple of weeks
- title: the role title inferred from the job description
`

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(interviewReportSchema),
        }
    })

    return JSON.parse(response.text)


}



async function generatePdfFromHtml(htmlContent) {
    // Use `load` instead of `networkidle0` because the AI-generated HTML is
    // fully self-contained (no external resources to wait for). networkidle0
    // can hang indefinitely on a page that schedules background work, which
    // was the root cause of the 30s puppeteer timeout.
    const browser = await puppeteer.launch({
        headless: true,
        args: [ "--no-sandbox", "--disable-setuid-sandbox" ]
    })

    try {
        const page = await browser.newPage()
        await page.setContent(htmlContent, { waitUntil: "load", timeout: 60000 })
        await page.emulateMediaType("print")

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            },
            timeout: 60000
        })

        return pdfBuffer
    } finally {
        await browser.close()
    }
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {

    const resumePdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
    })

    const prompt = `Generate resume for a candidate with the following details:
                        Resume: ${resume}
                        Self Description: ${selfDescription}
                        Job Description: ${jobDescription}

                        the response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
                        The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.
                        The content of resume should be not sound like it's generated by AI and should be as close as possible to a real human-written resume.
                        you can highlight the content using some colors or different font styles but the overall design should be simple and professional.
                        The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
                        The resume should not be so lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.
                    `

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(resumePdfSchema),
        }
    })


    const jsonContent = JSON.parse(response.text)

    const pdfBuffer = await generatePdfFromHtml(jsonContent.html)

    return pdfBuffer

}

async function scoreAnswer({ question, modelAnswer, userAnswer }) {
    const scoreSchema = z.object({
        score: z.number().min(0).max(100).describe('Numeric score between 0 and 100'),
        feedback: z.string().describe('Short feedback to the candidate')
    })

    const prompt = `You are a senior interviewer. Given the interview question, the ideal model answer and the candidate's answer, provide a JSON response with two fields: score (0-100) and feedback (brief).\nQuestion: ${question}\nModel Answer: ${modelAnswer}\nCandidate Answer: ${userAnswer}\nRespond ONLY with a JSON object matching the schema.`

    const response = await generateContentWithFallback({
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: zodToJsonSchema(scoreSchema)
        }
    })

    return JSON.parse(response.text)
}

module.exports = { generateInterviewReport, generateResumePdf, scoreAnswer }
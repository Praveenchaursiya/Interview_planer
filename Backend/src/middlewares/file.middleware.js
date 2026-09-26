const multer = require("multer")

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const fileName = (file.originalname || "").toLowerCase()
        const isAllowed = fileName.endsWith(".pdf") || fileName.endsWith(".docx")

        if (!isAllowed) {
            return cb(new Error("Only PDF and DOCX resume files are allowed."))
        }

        cb(null, true)
    }
})

module.exports = upload
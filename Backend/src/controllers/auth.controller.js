const userModel = require("../models/user.model")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const tokenBlacklistModel = require("../models/blacklist.model")

/**
 * @name registerUserController
 * @description register a new user, expects username, email and password in the request body
 * @access Public
 */
async function registerUserController(req, res) {

    const { username, email, password } = req.body

    if (!username || !email || !password) {
        return res.status(400).json({
            message: "Please provide username, email and password"
        })
    }

    const isUserAlreadyExists = await userModel.findOne({
        $or: [ { username }, { email } ]
    })

    if (isUserAlreadyExists) {
        return res.status(400).json({
            message: "Account already exists with this email address or username"
        })
    }

    const hash = await bcrypt.hash(password, 10)

    const user = await userModel.create({
        username,
        email,
        password: hash
    })

    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    res.status(201).json({
        message: "User registered successfully",
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })

}


/**
 * @name loginUserController
 * @description login a user, expects email and password in the request body
 * @access Public
 */
async function loginUserController(req, res) {

    const { email, password } = req.body

    const user = await userModel.findOne({ email })

    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
        return res.status(400).json({
            message: "Invalid email or password"
        })
    }

    const token = jwt.sign(
        { id: user._id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    res.status(200).json({
        message: "User loggedIn successfully.",
        token,
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })
}


/**
 * @name logoutUserController
 * @description clear token from user cookie and add the token in blacklist
 * @access public
 */
async function logoutUserController(req, res) {
    const authHeader = req.headers.authorization
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : req.cookies.token

    if (token) {
        await tokenBlacklistModel.create({ token })
    }

    res.status(200).json({
        message: "User logged out successfully"
    })
}

/**
 * @name getMeController
 * @description get the current logged in user details.
 * @access private
 */
async function getMeController(req, res) {

    const user = await userModel.findById(req.user.id)



    res.status(200).json({
        message: "User details fetched successfully",
        user: {
            id: user._id,
            username: user.username,
            email: user.email
        }
    })

}



async function adminLoginBypassController(req, res) {
    if (process.env.ADMIN_BYPASS_ENABLED !== "true") {
        return res.status(403).json({
            message: "Admin bypass is disabled."
        })
    }

    const email = process.env.ADMIN_BYPASS_EMAIL || "admin@example.com"
    const username = process.env.ADMIN_BYPASS_USERNAME || "admin"
    const password = process.env.ADMIN_BYPASS_PASSWORD || Math.random().toString(36).slice(2)

    let adminUser = await userModel.findOne({ email })

    if (!adminUser) {
        const hash = await bcrypt.hash(password, 10)
        adminUser = await userModel.create({
            username,
            email,
            password: hash
        })
    }

    const token = jwt.sign(
        { id: adminUser._id, username: adminUser.username, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
    )

    res.status(200).json({
        message: "Admin bypass login successful.",
        token,
        user: {
            id: adminUser._id,
            username: adminUser.username,
            email: adminUser.email,
            role: "admin"
        }
    })
}

module.exports = {
    registerUserController,
    loginUserController,
    logoutUserController,
    getMeController,
    adminLoginBypassController
}
const { createInMemoryModel } = require("../config/inMemoryStore")

const userModel = createInMemoryModel("users")

module.exports = userModel
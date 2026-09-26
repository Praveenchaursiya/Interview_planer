const { createInMemoryModel } = require("../config/inMemoryStore")

const tokenBlacklistModel = createInMemoryModel("blacklistTokens")

module.exports = tokenBlacklistModel
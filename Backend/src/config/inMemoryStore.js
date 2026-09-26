const crypto = require("crypto")

function createInMemoryModel(collectionName) {
    const items = []

    function generateId() {
        return crypto.randomUUID()
    }

    function matchesQuery(item, query) {
        if (!query || typeof query !== "object" || Array.isArray(query)) {
            return true
        }

        for (const [key, value] of Object.entries(query)) {
            if (key === "$or") {
                if (!Array.isArray(value)) {
                    return false
                }

                const matchedAny = value.some((subQuery) => matchesQuery(item, subQuery))
                if (!matchedAny) {
                    return false
                }
                continue
            }

            if (value === undefined) {
                continue
            }

            if (item[key] !== value) {
                return false
            }
        }

        return true
    }

    function applySelect(doc, selectValue) {
        if (!selectValue) {
            return { ...doc }
        }

        if (typeof selectValue === "string") {
            const excludedFields = selectValue
                .split(" ")
                .filter(Boolean)
                .filter((field) => field.startsWith("-"))
                .map((field) => field.slice(1))

            const result = { ...doc }
            excludedFields.forEach((field) => {
                delete result[field]
            })
            return result
        }

        return { ...doc }
    }

    class Query {
        constructor(model, query) {
            this.model = model
            this.query = query || {}
            this.sortConfig = null
            this.selectValue = null
        }

        sort(sortConfig) {
            this.sortConfig = sortConfig || null
            return this
        }

        select(selectValue) {
            this.selectValue = selectValue
            return this
        }

        async exec() {
            let results = this.model._findInternal(this.query)

            if (this.sortConfig) {
                results = [...results].sort((a, b) => {
                    const entries = Object.entries(this.sortConfig)
                    for (const [field, direction] of entries) {
                        const aValue = a[field]
                        const bValue = b[field]

                        if (aValue === bValue) {
                            continue
                        }

                        if (direction === -1) {
                            return aValue > bValue ? -1 : 1
                        }

                        return aValue > bValue ? 1 : -1
                    }
                    return 0
                })
            }

            return results.map((doc) => applySelect(doc, this.selectValue))
        }

        then(resolve, reject) {
            return this.exec().then(resolve, reject)
        }

        catch(reject) {
            return this.exec().catch(reject)
        }

        finally(callback) {
            return this.exec().finally(callback)
        }
    }

    const model = {
        collectionName,
        _findInternal(query) {
            return items.filter((item) => matchesQuery(item, query))
        },
        async create(payload) {
            const doc = {
                ...payload,
                _id: payload._id || generateId(),
                createdAt: payload.createdAt || new Date(),
                updatedAt: payload.updatedAt || new Date()
            }
            items.push(doc)
            return doc
        },
        async findOne(query = {}) {
            return this._findInternal(query)[0] || null
        },
        async findById(id) {
            return items.find((item) => String(item._id) === String(id)) || null
        },
        find(query = {}) {
            return new Query(this, query)
        }
    }

    return model
}

module.exports = { createInMemoryModel }

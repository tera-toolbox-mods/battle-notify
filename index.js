'use strict'

const enabled = true
const debug = false
const AbnormalManager = require('./lib/abnormal')
const CooldownManager = require('./lib/cooldown')
const EntityManager = require('./lib/entity')
const PartyManager = require('./lib/party')
const Notify = require('./lib/notify')

const isDefined = x => typeof x !== 'undefined'
const isArray = x => x instanceof Array
const isError = x => x instanceof Error
const toArray = x => isArray(x) ? x : (isDefined(x) ? [x] : [])
const toSet = x => new Set(toArray(x))
const thisIfGreater = (x, y) => (x > y) ? x : false
//const thisIfSmaller = (x, y) => (x < y) ? x : false
//const skillGroup = x => Math.floor(x / 10000)
const msRemaining = uts => uts - Date.now()
const sRemaining = uts => Math.round(msRemaining(uts) / 1000)
const matchExpiring = (set, uts) => set.has(sRemaining(uts))

function tryIt(func) {
    try {
        return func()
    } catch (e) {
        return e
    }
}

function logError(message) {
    console.error(Array.isArray(message) ? message.join('\n') : message)
}

function BattleNotify(mod) {

    const abMan = new AbnormalManager(mod)
    const cooldown = new CooldownManager(mod)
    const entities = new EntityManager(mod, debug)
    const party = new PartyManager(mod)
    const notify = new Notify(mod)
    const conditions = new Conditions()
    const targets = new Targets()
    const events = new Set()

    const combat = () => entities.myEntity().combat
    const enrage = () => entities.myBoss().enraged

    let interval = null

    mod.hook('S_LOGIN', 'event', () => {
        if (enabled) {
            interval = mod.setInterval(checkEvents, 500)
            refreshConfig()
        }
    })
    mod.hook('S_RETURN_TO_LOBBY', 'event', () => {
        mod.clearInterval(interval)
    })
    mod.hook('S_PRIVATE_CHAT', 'event', () => {
        if (!debug) return
        mod.setTimeout(refreshConfig, 5)
    })

    function Conditions() {
        function AbnormalConditions() {
            const checkAdded = (lastMatch, { added } = {}) => added
            const checkRemoved = (lastMatch, { removed } = {}) => removed

            function AddedOrRefreshed({ requiredStacks } = {}) {
                this.requiredStacks = requiredStacks
                return checkAddedOrRefreshed.bind(this)
            }
            function checkAddedOrRefreshed(lastMatch, { stacks = 0, added, refreshed } = {}) {
                if (stacks > this.requiredStacks)
                    return refreshed || added
            }

            function Refreshed({ requiredStacks } = {}) {
                this.requiredStacks = requiredStacks
                return checkRefreshed.bind(this)
            }
            function checkRefreshed(lastMatch, { stacks = 0, refreshed, added } = {}) {
                if (stacks > this.requiredStacks)
                    return refreshed || added
            }

            function Expiring({ timesToMatch } = {}) {
                this.timesToMatch = timesToMatch
                return checkExpiring.bind(this)
            }
            function checkExpiring(lastMatch, { expires = 0, added, refreshed } = {}) {
                if (matchExpiring(this.timesToMatch, expires))
                    return (refreshed || added) + sRemaining(expires)
            }

            function Missing({ rewarnTimeout } = {}) {
                this.rewarnTimeout = rewarnTimeout * 1000
                return checkMissing.bind(this)
            }
            function checkMissing(lastMatch, { added, refreshed } = {}) {
                if (added || refreshed) return
                return thisIfGreater(Date.now(), lastMatch + this.rewarnTimeout)
            }

            function MissingDuringCombat({ rewarnTimeout } = {}) {
                this.rewarnTimeout = rewarnTimeout * 1000
                return checkMissingDuringCombat.bind(this)
            }
            function checkMissingDuringCombat(lastMatch, { added, refreshed } = {}) {
                if (added || refreshed || !combat()) return
                return thisIfGreater(Date.now(), lastMatch + this.rewarnTimeout)
            }

            this.added = (x) => checkAdded
            this.removed = (x) => checkRemoved
            this.addedorrefreshed = (x) => new AddedOrRefreshed(x)
            this.refreshed = (x) => new Refreshed(x)
            this.expiring = (x) => new Expiring(x)
            this.missing = (x) => new Missing(x)
            this.missingduringcombat = (x) => new MissingDuringCombat(x)
        }

        function CooldownConditions() {

            function Expiring({ timesToMatch } = {}) {
                this.timesToMatch = timesToMatch
                return checkExpiring.bind(this)
            }
            function checkExpiring(lastMatch, { expires } = {}) {
                if (matchExpiring(this.timesToMatch, expires))
                    return expires - sRemaining(expires)
            }

            function ExpiringDuringCombat({ timesToMatch } = {}) {
                this.timesToMatch = timesToMatch
                return checkExpiringDuringCombat.bind(this)
            }
            function checkExpiringDuringCombat(lastMatch, { expires = 0 } = {}) {
                if (combat())
                    return checkExpiring.call(this, ...arguments)
            }

            function ExpiringDuringEnrage({ timesToMatch } = {}) {
                this.timesToMatch = timesToMatch
                return checkExpiringDuringEnrage.bind(this)
            }
            function checkExpiringDuringEnrage(lastMatch, { expires = 0 } = {}) {
                if (enrage)
                    return checkExpiringDuringCombat.call(this, ...arguments)
            }

            function Ready({ rewarnTimeout } = {}) {
                this.rewarnTimeout = rewarnTimeout * 1000
                return checkReady.bind(this)
            }
            function checkReady(lastMatch, { expires = 0 } = {}) {
                if (Date.now() > expires)
                    return thisIfGreater(Date.now(), lastMatch + this.rewarnTimeout)
            }

            function ReadyDuringCombat({ rewarnTimeout } = {}) {
                this.rewarnTimeout = rewarnTimeout * 1000
                return checkReadyDuringCombat.bind(this)
            }
            function checkReadyDuringCombat(lastMatch, { expires = 0 } = {}) {
                if (combat())
                    return checkReady.call(this, ...arguments)
            }

            function ReadyDuringEnrage({ rewarnTimeout } = {}) {
                this.rewarnTimeout = rewarnTimeout * 1000
                return checkReadyDuringEnrage.bind(this)
            }
            function checkReadyDuringEnrage(lastMatch, { expires = 0 } = {}) {
                if (enrage())
                    return checkReadyDuringCombat.call(this, ...arguments)
            }

            this.expiring = (x) => new Expiring(x)
            this.expiringduringcombat = (x) => new ExpiringDuringCombat(x)
            this.expiringduringenrage = (x) => new ExpiringDuringEnrage(x)
            this.ready = (x) => new Ready(x)
            this.readyduringcombat = (x) => new ReadyDuringCombat(x)
            this.readyduringenrage = (x) => new ReadyDuringEnrage(x)
        }

        this.cooldown = new CooldownConditions()
        this.abnormal = new AbnormalConditions()
    }

    function Targets() {
        function AbnormalTargets() {
            this.self = () => [entities.myCid()]
            this.myboss = () => [entities.myBossId()]
            this.party = () => party.members()
                .filter(cid => cid !== entities.myCid())
            this.partyincludingself = () => party.members()
        }
        function CooldownTargets(skills, items) {
            skills = Array.from(skills)
            items = Array.from(items)
            return () =>
                skills.map(id => cooldown.skill(id))
                    .concat(items.map(id => cooldown.item(id)))
        }
        this.cooldown = CooldownTargets
        this.abnormal = new AbnormalTargets()
    }

    function AbnormalEvent(data) {
        const type = data.type.toLowerCase()
        const target = data.target.toLowerCase()
        const getTargets = targets.abnormal[target]
        const event = {}
        const args = event.args = {
            timesToMatch: toSet(data.time_remaining || 6),
            rewarnTimeout: data.rewarn_timeout || 5,
            requiredStacks: data.required_stacks || 1
        }
        event.abnormalities = toSet(data.abnormalities)
        event.condition = conditions.abnormal[type](args)
        event.message = data.message
        event.lastMatches = new Map()
        event.matchAll = type.includes('missing')

        this.check = function () {
            getTargets()
                .map(id => tryIt(() => checkAbnormalEvent(id, event)))
                .filter(isError)
                .forEach(err => logError([
                    `[battle-notify] AbnormalEvent.check: error while checking event`,
                    `event: ${JSON.stringify(event || {})}`,
                    err.stack
                ]))
        }
    }
    function checkAbnormalEvent(entityId, event) {
        if (!entityId) return
        const entity = entities.get(entityId)
        if (entity.dead) return

        entityId = entityId.toString()
        if (!event.lastMatches.has(entityId))
            event.lastMatches.set(entityId, 0)

        const results = new Set()
        let info
        let currentMatch

        for (const abnormal of event.abnormalities) {
            const lastMatch = event.lastMatches.get(entityId)
            const abnormalInfo = abMan.get(entityId, abnormal)
            const match = event.condition(lastMatch, abnormalInfo)

            if (match && match !== lastMatch) {
                currentMatch = match
                info = abnormalInfo
                results.add(true)
            } else results.add(false)
        }

        if (event.matchAll && results.has(false) || !results.has(true)) return
        notify.abnormal(event.message, entity, info)
        event.lastMatches.set(entityId, currentMatch)
    }

    function CooldownEvent(data) {
        data.skills = toArray(data.skills)
        data.items = toArray(data.items)
        const type = data.type.toLowerCase()
        const getTargets = targets.cooldown(data.skills, data.items)
        const event = {}
        const args = event.args = {
            timesToMatch: toSet(data.time_remaining || 6),
            rewarnTimeout: data.rewarn_timeout || 5
        }
        event.condition = conditions.cooldown[type](args)
        event.message = data.message
        event.lastMatches = new Map()

        this.check = function () {
            getTargets()
                .map(info =>
                    tryIt(() => checkCooldownEvent(info, event)))
                .filter(isError)
                .forEach(err => logError([
                    `[battle-notify] CooldownEvent.check: error while checking event`,
                    `event: ${JSON.stringify(event || {})}`,
                    err.stack
                ]))
        }
    }
    function checkCooldownEvent(info, event) {
        const id = info.item ? info.item : info.skill
        if (!event.lastMatches.has(id))
            event.lastMatches.set(id, 0)

        const lastMatch = event.lastMatches.get(id)
        const match = event.condition(lastMatch, info)
        if (match && match !== lastMatch) {
            notify.cooldown(event.message, info)
            event.lastMatches.set(id, match)
        }
    }

    function ResetEvent(data) {
        cooldown.onReset(toArray(data.skills), info => {
            notify.skillReset(data.message, info)
        })
        this.check = function () { }
    }

    function refreshConfig() {
        events.clear()
        cooldown.clearResetHooks()

        loadEvents('./config/' + entities.self().class)
        loadEvents('./config/common')

        loadStyling('./config/common_styling.js')
    }
    function loadStyling(path) {
        const data = require(path)
        if (!data) return
        notify.setDefaults(data)
    }
    function loadEvent(event) {
        let type
        if (event.abnormalities)
            type = AbnormalEvent
        else if (event.type && event.type.toLowerCase() === 'reset')
            type = ResetEvent
        else if (event.skills || event.items)
            type = CooldownEvent

        return new type(event)
    }
    function loadEvents(path) {
        const data = require(path)

        toArray(data)
            .forEach(event => {
                const result = tryIt(() => loadEvent(event))

                if (isError(result)) {
                    logError([
                        `[battle-notify] loadEvents error while loading event from ${path}`,
                        `event: ${JSON.stringify(event)}`,
                        result.stack
                    ])
                    return
                }
                events.add(result)
            })
    }
    function checkEvents() {
        events.forEach(e => e.check())
    }

    if (debug) {
        mod.send('C_CHAT', 1, { "channel": 11, "message": "<FONT></FONT>" })

        //notify.testColors()
    }
}


module.exports = BattleNotify;
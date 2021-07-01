'use strict'

const jobs = [
    'warrior',
    'lancer',
    'slayer',
    'berserker',
    'sorcerer',
    'archer',
    'priest',
    'mystic',
    'reaper',
    'gunner',
    'brawler',
    'ninja',
    'valkyrie'
]
const self = {
    cid: -1n,
    class: 'Default.Class',
    name: 'Default.Name'
}
const entities = new Map()

module.exports = function EntityManager(mod, debug){
    mod.game.initialize('party')
    mod.hook('S_BOSS_GAGE_INFO', 3, (event) => {
        const entity = getEntity(event.id)
        entity.boss = true
        if(!entity.name) entity.name = `{@Creature:${event.huntingZoneId}#${event.templateId}}`
        const player = getEntity(self.cid)
        if(!player.target) player.target = event.id
    })
    mod.hook('S_EACH_SKILL_RESULT', mod.majorPatchVersion >= 86 ? 14 : 13, (event) => {
        const entity = getEntity(event.target)
        if(!entity.boss) return
        const player = getEntity(event.source)
        player.target = event.target
    })
    mod.hook('S_CREATURE_CHANGE_HP', 6, (event) => {
        const entity = getEntity(event.target)
        entity.hp = Number(event.curHp * 100n / event.maxHp)
    })
    mod.hook('S_CREATURE_LIFE', 3, (event) => {
        const entity = getEntity(event.gameId)
        entity.dead = !event.alive
    })
    mod.hook('S_NPC_STATUS', 2, (event) => {
        const entity = getEntity(event.gameId)
        if(event.enraged) {
            entity.enraged = true
        } else {
            if(entity.enraged && entity.hp > 0) {
                entity.nextEnrage = entity.hp - 10
                if(entity.nextEnrage < 0) entity.nextEnrage = 0
            }
            entity.enraged = false
        }
    })
    mod.hook('S_DESPAWN_NPC', 3, (event) => {
        const entity = getEntity(event.gameId)
        if(event.type === 5 || event.type === 3) entity.dead = true
    })
    mod.hook('S_SPAWN_ME', 3, (event) => {
        const entity = getEntity(event.gameId)
        entity.dead = !event.alive
        entity.name = self.name
        entity.class = self.class
    })
    mod.hook('S_SPAWN_USER', mod.majorPatchVersion >= 101 ? 17 : 16, (event) => {
        const entity = getEntity(event.gameId)
        const job = (event.templateId - 10101) % 100
        entity.name = event.name
        entity.class = jobs[job]
        entity.dead = !event.alive
    })
    mod.hook('S_USER_STATUS', 3, (event) => {
        const entity = getEntity(event.gameId)
        entity.combat = (event.status === 1)
    })
    mod.game.party.on('list', processPartyList)
    //mod.hook('S_PARTY_MEMBER_INFO', 3, processPartyList)

    function processPartyList(members) {
        members.forEach(member => {
            const entity = getEntity(member.gameId)
            // handling case where gameId can be 0n so false is returned instead of object reference from shitcode (c) Salty
            if (entity) entity.name = member.name
        })
    }

    function getEntity(id){
        if(!id) return false
        id = id.toString()
        if(!entities.has(id)) entities.set(id, {})
        // this is one from dumbiest ways to use references (c) Salty 
        return entities.get(id)
    }

    mod.hook('S_LOGIN', mod.majorPatchVersion >= 86 ? 14 : 13, (event) => {
        const entity = getEntity(event.gameId)
        const job = (event.templateId - 10101) % 100
        entity.name = event.name
        entity.class = jobs[job]
        entity.dead = !event.alive

        self.cid = event.gameId
        self.name = event.name
        self.class = jobs[job]
    })
    mod.hook('S_PRIVATE_CHAT', 1, (event) => {
        if(!debug) return
        self.cid = event.authorID
        self.name = event.authorName
    })
    mod.hook('S_LOAD_TOPO', 3, (event) => {
        entities.clear()
    })
    this.get = getEntity
    this.myCid = function(){
        return self.cid.toString()
    }
    this.myEntity = function(){
        return getEntity(self.cid)
    }
    this.myBoss = function(){
        return getEntity(this.myBossId())
    }
    this.myBossId = function(){
        const entity = this.myEntity()
        return (entity.target || 0n).toString()
    }
    this.self = function(){
        return self
    }
}

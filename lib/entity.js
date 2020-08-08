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
    cid: {},
    class: 'warrior',
    name: 'Default.Name'
}
const entities = new Map()

module.exports = function EntityManager(mod, debug){
    mod.hook('S_BOSS_GAGE_INFO', 3, (event) => {
        const entity = getEntity(event.id)
        entity.boss = true
        if(!entity.name) entity.name = `{@Creature:${event.type}#${event.npc}}`
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
    mod.hook('S_SPAWN_USER', 15, (event) => {
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
    mod.hook('S_PARTY_MEMBER_LIST', 7, processPartyList)
    //mod.hook('S_PARTY_MEMBER_INFO', 3, processPartyList)

    function processPartyList(event) {
        event.members.forEach(member => {
            if(!member.gameId) return //Band-fix for the bug where the server keeps sending empty gameIds - the first few packets right after getting matched.
            const entity = getEntity(member.gameId)
            entity.name = member.name
        })
    }
    function getEntity(id){
        if(!id) return false
        id = id.toString()
        if(!entities.has(id)) entities.set(id, {})
        return entities.get(id)
    }

    mod.hook('S_LOGIN', mod.majorPatchVersion >= 86 ? 14 : 13, (event) => {
        const entity = getEntity(event.gameId)
        const job = (event.templateId - 10101) % 100
        entity.name = event.name
        entity.class = jobs[job]

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
        return self.cid
    }
    this.myEntity = function(){
        return getEntity(self.cid)
    }
    this.myBoss = function(){
        return getEntity(this.myBossId())
    }
    this.myBossId = function(){
        const entity = this.myEntity()
        return entity.target
    }
    this.self = function(){
        return self
    }
}

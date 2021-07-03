'use strict'

const ID_ENRAGE = 8888888
const entities = new Map()

module.exports = function AbnormalManager(mod, debug){
    mod.hook('S_ABNORMALITY_BEGIN', mod.majorPatchVersion <= 106 ? 4 : 5, addAbnormal)
    mod.hook('S_ABNORMALITY_REFRESH', 2, refreshAbnormal)
    mod.hook('S_ABNORMALITY_END', 1, removeAbnormal)

    /*if (debug) {
        mod.game.initialize('party')
        mod.hook('S_PARTY_MEMBER_ABNORMAL_ADD', 3, addAbnormalSidPid)
        mod.hook('S_PARTY_MEMBER_ABNORMAL_REFRESH', 3, refreshAbnormalSidPid)
        mod.hook('S_PARTY_MEMBER_BUFF_UPDATE', 2, refreshListAbnormalSidPid)
        mod.hook('S_PARTY_MEMBER_ABNORMAL_DEL', 2, removeAbnormalSidPid)
    }*/

    mod.hook('S_LOAD_TOPO', 'event', () => {
        entities.clear()
    })

    mod.hook('S_NPC_STATUS', 2, (event) => {
        const entity = getEntity(event.gameId)
        if(event.enraged) {
            if(!entity.get('enraged'))
                addAbnormal({
                    target: event.gameId,
                    source: 0n,
                    id: ID_ENRAGE,
                    duration: BigInt(event.remainingEnrageTime),
                    stacks: 1
                })
            entity.set('enraged', true)
        } else {
            if(entity.get('enraged'))
                removeAbnormal({
                    target: event.gameId,
                    id: ID_ENRAGE
                })
            entity.set('enraged', false)
        }
    })

    function abnormalIcon(id){
        let icon
        if(id === ID_ENRAGE){
            icon = `<img src='img://item__8626' width='48' height='48' vspace='-7' />`
        } else {
            icon = `<img src='img://abonormality__${id}' width='48' height='48' vspace='-7' />`
        }
        return icon
    }
    function getEntity(id){
        if(!id) return false
        id = id.toString()
        if(!entities.has(id)) entities.set(id, new Map())
        return entities.get(id)
    }
    function getAbnormal(entityId, abnormalId){
        const entity = getEntity(entityId)
        if(!entity.has(abnormalId)) entity.set(abnormalId, {})
        const abnormal = entity.get(abnormalId)
        if(!abnormal.icon) abnormal.icon = abnormalIcon(abnormalId)
        return abnormal
    }
    function addAbnormal(event){
        const nowMs = Date.now()
        const abnormal = getAbnormal(event.target, event.id)
        abnormal.added = BigInt(nowMs)
        abnormal.expires = BigInt(nowMs) + event.duration
        abnormal.stacks = event.stacks
        delete abnormal.refreshed
        delete abnormal.removed
    }
    function refreshAbnormal(event){
        const nowMs = Date.now()
        const abnormal = getAbnormal(event.target, event.id)
        if(!abnormal.added)
            abnormal.added = BigInt(nowMs)
        //if(event.stacks !== abnormal.stacks) // It can be replaced with new without stack change.
            abnormal.refreshed = BigInt(nowMs)
        abnormal.expires = BigInt(nowMs) + event.duration
        abnormal.stacks = event.stacks
    }
    function removeAbnormal(event){
        const nowMs = Date.now()
        const abnormal = getAbnormal(event.target, event.id)
        abnormal.removed = BigInt(nowMs)
        delete abnormal.added
        delete abnormal.refreshed
        delete abnormal.expires
        delete abnormal.stacks
    }

    function getEntityGidFromPartySidPid(serverId, playerId) {
        if (!mod.game.party.inParty()) return undefined
        const isValidPartyMember = mod.game.party.partyMembers.findIndex(element => element.gameId !== 0 && element.serverId === serverId && element.playerId === playerId)
        if (debug) console.log(`BN => [Party handler] Event to '${(mod.game.party.partyMembers.find(elo => elo.serverId === serverId && elo.playerId === playerId)?.name) || 'mod.game.party is reporting does not exist! '}' with ${(isValidPartyMember !== -1) ? '' : 'In'}valid @index:${isValidPartyMember}.`)
        if (isValidPartyMember === -1) return undefined
        return mod.game.party.partyMembers[isValidPartyMember].gameId
    }
    function addAbnormalSidPid(event) {
        const target = getEntityGidFromPartySidPid(event.serverId, event.playerId)
        if (!target) return
        addAbnormal({
            target,
            source: 0n,
            id: event.id,
            duration: BigInt(event.duration),
            stacks: event.stacks
        })
    }
    function refreshAbnormalSidPid(event) {
        const target = getEntityGidFromPartySidPid(event.serverId, event.playerId)
        if (!target) return
        refreshAbnormal({
            target,
            source: 0n,
            id: event.id,
            duration: BigInt(event.duration),
            stacks: event.stacks
        })
    }
    function refreshListAbnormalSidPid(event) {
        const target = getEntityGidFromPartySidPid(event.serverId, event.playerId)
        if (!target) return

        if (!entities.has(target))  //Add
            for (const abn of event.abnormals)
                addAbnormal({
                    target,
                    source: 0n,
                    id: abn.id,
                    duration: BigInt(abn.duration),
                    stacks: abn.stacks
                })
        else {
            const thisEntity = entities.get(target)

            for (const abn of event.abnormals)
                if (!thisEntity.has(abn.id))  //Add
                    addAbnormal({
                        target,
                        source: 0n,
                        id: abn.id,
                        duration: BigInt(abn.duration),
                        stacks: abn.stacks
                    })
                else {
                    if (!abnormal.added)  //Add
                        addAbnormal({
                            target,
                            source: 0n,
                            id: abn.id,
                            duration: BigInt(abn.duration),
                            stacks: abn.stacks
                        })
                    else //Refresh
                        refreshAbnormal({
                            target,
                            source: 0n,
                            id: abn.id,
                            duration: BigInt(abn.duration),
                            stacks: abn.stacks
                        })
                }
            const lastAbnIds = thisEntity.keys(),
                currAbnIds = event.abnormals.map(i => i.id)
            lastAbnIds.forEach(el => {
                if (currAbnIds.indexOf(el) === -1) //Removed
                    removeAbnormal({
                        target,
                        id: el
                    })
            })

        }
    }
    function removeAbnormalSidPid(event) {
        const target = getEntityGidFromPartySidPid(event.serverId, event.playerId)
        if(!target) return
        removeAbnormal({
            target,
            id: event.id
        })
    }
    this.get = getAbnormal
}

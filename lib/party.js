'use strict'

const party = new Map()

module.exports = function PartyManager(mod){
    mod.game.initialize('party')
    mod.game.party.on('list', processPartyList)
    mod.game.party.on('member_leave', (event) => {
        party.delete(event.playerId.toString())
    })
    mod.hook('S_LOGOUT_PARTY_MEMBER', 1, event => {
        party.delete(event.playerId.toString())
    })
    mod.game.party.on('leave', () => {
        party.clear()
    })
    function processPartyList(members) {
        party.clear()
        members.forEach(member => {
            party.set(
                member.playerId.toString(),
                member.gameId.toString()
            )
        })
    }
    this.members = function(){
        return Array.from(party.values())
    }
    this.isMember = function(id){
        id = id.toString()
        return [...party.values()].includes(id) || party.has(id)
    }
}

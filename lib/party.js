'use strict'

const party = new Map()

module.exports = function PartyManager(mod) {

    // ~~~ * Initialize dependency * ~~~ \\
    mod.game.initialize('party')

    mod.game.party.on('list', processPartyList)
    mod.game.party.on('member_leave', (event) => { party.delete(event.playerId.toString()) })
    mod.game.party.on('leave', () => { party.clear() })

    function processPartyList(members) {
        party.clear()
        members.forEach(member => {
            party.set(
                member.playerId.toString(),
                member.gameId.toString()
            )
        })
    }
    this.members = function () {
        return Array.from(party.values())
    }
    this.isMember = function (id) { return mod.game.party.isMember(BigInt(id)) }
}

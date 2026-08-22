import { customAlphabet } from 'nanoid'
import { CODE_ALPHABET, CODE_LENGTH } from '../constants.js'
import { LobbyModel } from '../models/lobby.model.js'

const nanoid = customAlphabet(CODE_ALPHABET, CODE_LENGTH)

export const generateUniqueLobbyCode = async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
        const code = nanoid()
        // eslint-disable-next-line no-await-in-loop
        const existing = await LobbyModel.exists({ code })
        if (!existing) return code
    }
    throw new Error('Impossible de générer un code de lobby unique')
}

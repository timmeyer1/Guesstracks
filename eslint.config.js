const expoConfig = require('eslint-config-expo/flat')

module.exports = [
    {
        // server/ c'est un projet Node à part (pas de JSX, pas de globals RN),
        // dcp le lint app s'applique qu'à app/ et aux fichiers de config racine.
        ignores: ['server/**', '.expo/**'],
    },
    ...expoConfig,
    {
        rules: {
            // active enfin les eslint-disable-next-line exhaustive-deps
            // déjà présents dans le code, personne ne les vérifiait avant.
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
]

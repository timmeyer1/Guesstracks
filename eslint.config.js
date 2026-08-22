const expoConfig = require('eslint-config-expo/flat')

module.exports = [
    {
        // server/ est un projet Node séparé (Express/Socket.IO, pas de JSX,
        // pas de globals RN) : le lint côté app ne s'applique qu'à app/ et
        // aux fichiers de config à la racine. .expo/ est un cache généré.
        ignores: ['server/**', '.expo/**'],
    },
    ...expoConfig,
    {
        rules: {
            // rend enfin actifs les `eslint-disable-next-line
            // react-hooks/exhaustive-deps` déjà présents dans le code (cf.
            // audit qualité, finding I6) : jusqu'ici aucun outil ne tournait
            // pour les vérifier, ni en local ni en CI.
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
]

import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useTrackStore } from '../../stores/tracks.store';

const areHydrated = () => useAuthStore.persist.hasHydrated() && useTrackStore.persist.hasHydrated();

// true dès que la session persistée (cf. auth.store.ts, tracks.store.ts) a
// fini d'être relue depuis le stockage local — à utiliser pour ne rendre
// AuthNavigator qu'une fois isAuthenticated fiable, sinon un flash de l'écran
// de connexion est visible avant que la session restaurée ne s'applique
export const useStoresHydrated = () => {
    const [hydrated, setHydrated] = useState(areHydrated);

    useEffect(() => {
        if (hydrated) return;

        const check = () => {
            if (areHydrated()) setHydrated(true);
        };

        // au cas où l'hydratation se serait terminée entre le useState
        // initial (évalué avant le montage) et cet abonnement
        check();

        const unsubAuth = useAuthStore.persist.onFinishHydration(check);
        const unsubTracks = useTrackStore.persist.onFinishHydration(check);

        return () => {
            unsubAuth();
            unsubTracks();
        };
    }, [hydrated]);

    return hydrated;
};

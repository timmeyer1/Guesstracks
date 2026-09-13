import { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useTrackStore } from '../../stores/tracks.store';

const areHydrated = () => useAuthStore.persist.hasHydrated() && useTrackStore.persist.hasHydrated();

// Passe à true quand la session sauvegardée a fini d'être relue. Dcp on
// attend ça avant d'afficher AuthNavigator, sinon on voit flasher l'écran de connexion.
export const useStoresHydrated = () => {
    const [hydrated, setHydrated] = useState(areHydrated);

    useEffect(() => {
        if (hydrated) return;

        const check = () => {
            if (areHydrated()) setHydrated(true);
        };

        check(); // au cas où tout soit déjà chargé entre le useState initial et cet abonnement

        const unsubAuth = useAuthStore.persist.onFinishHydration(check);
        const unsubTracks = useTrackStore.persist.onFinishHydration(check);

        return () => {
            unsubAuth();
            unsubTracks();
        };
    }, [hydrated]);

    return hydrated;
};

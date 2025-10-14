export type TrackType = {
    href: string;
    total: number;
    limit: number;
    next: string | null;
    items: {
        added_at: string;
        track: {
            id: string;
            name: string;
            popularity: number;
            explicit: boolean;
            track_number: number;
            type: string;
            uri: string;
            duration_ms: number;

            album: {
                album_type: string;
                total_tracks: number;
                href: string;
                images: {
                    url: string;
                    height: number;
                    width: number;
                }[];
                name: string;
                release_date: string;
                type: string;
                uri: string;
                artists: {
                    name: string;
                    type: string;
                    uri: string;
                }[];
            };

            artists: {
                name: string;
                type: string;
                uri: string;
            }[];
        };
    }[];
};

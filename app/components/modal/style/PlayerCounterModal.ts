import {StyleSheet} from "react-native";

export const PlayerCounterModalstyle = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        backgroundColor: '#1a1a1a',
        width: '80%',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    subtitle: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 20,
    },
    counterContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 25,
    },
    counterButton: {
        borderRadius: 999,
        padding: 12,
        width: 60,
        alignItems: 'center',
    },
    counterText: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    count: {
        color: '#1DB954',
        fontSize: 36,
        fontWeight: 'bold',
        marginHorizontal: 25,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    button: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        alignItems: 'center',
    },
    cancel: {
        backgroundColor: '#333',
    },
    confirm: {
        backgroundColor: '#1DB954',
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
});

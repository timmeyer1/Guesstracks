import {StyleSheet} from "react-native";

export const lobbyScreenStyle = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
        padding: 20,
        justifyContent: 'center',
        paddingVertical: 80,
    },
    title: {
        fontSize: 24,
        color: '#fff',
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#aaa',
        textAlign: 'center',
    },
    info: {
        color: '#bbb',
        textAlign: 'center',
        marginBottom: 20,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1E1E1E',
        borderRadius: 10,
        padding: 10,
        marginBottom: 10,
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 10,
    },
    userName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    userType: {
        color: '#888',
        fontSize: 13,
    },
    emptyText: {
        color: '#888',
        textAlign: 'center',
        marginTop: 20,
    },
    footer: {
        marginTop: 20,
    },
})
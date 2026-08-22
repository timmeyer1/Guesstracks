import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/login.screen';
import { HomeScreen } from '../screens/home.screen';
import { useAuthStore } from '../stores/auth.store';
import LobbyScreen from "../screens/lobby.screen";
import GameScreen from "../screens/game.screen";
import { navigationRef } from "./navigationRef";

export type RootStackParamList = {
    Login: undefined
    Home: undefined
    Lobby: undefined
    Game: undefined
}

// permet à useNavigation() d'être correctement typé partout dans l'app sans
// avoir à répéter le générique à chaque appel
declare global {
    namespace ReactNavigation {
        interface RootParamList extends RootStackParamList {}
    }
}

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AuthNavigator = () => {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                    // transition native (accélérée matériellement) au lieu du fondu
                    // par défaut d'Android, pour un enchaînement plus fluide entre les écrans
                    animation: 'slide_from_right',
                    // durée par défaut ~350ms, ramenée à 200ms pour des transitions
                    // (fondu comme glissement) plus rapides entre les écrans
                    animationDuration: 200,
                }}
            >
                {!isAuthenticated ? (
                    // écran de déconnexion : fondu plutôt que glissement
                    <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
                ) : (
                    <>
                        {/* Home est la destination de "Quitter le lobby" / retour après
                        déconnexion : fondu, pour la distinguer du glissement utilisé
                        en entrant dans un lobby ou une partie */}
                        <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
                        <Stack.Screen
                            name="Lobby"
                            component={LobbyScreen}
                            options={{
                                gestureEnabled: false,  // Désactive le swipe
                                animation: 'slide_from_right',
                            }}
                        />
                        <Stack.Screen
                            name="Game"
                            component={GameScreen}
                            options={{
                                gestureEnabled: false,  // Désactive le swipe
                                animation: 'slide_from_right',
                            }}
                        />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

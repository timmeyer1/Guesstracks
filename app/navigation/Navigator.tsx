import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/login.screen';
import { ManualTrackPickerScreen } from '../screens/manualTrackPicker.screen';
import { HomeScreen } from '../screens/home.screen';
import { useAuthStore } from '../stores/auth.store';
import LobbyScreen from "../screens/lobby.screen";
import GameScreen from "../screens/game.screen";
import { navigationRef } from "./navigationRef";

export type RootStackParamList = {
    Login: undefined
    ManualTrackPicker: undefined
    Home: undefined
    Lobby: undefined
    Game: undefined
}

// dcp useNavigation() est bien typé partout sans répéter le générique à chaque fois
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
                    // glissement natif au lieu du fondu Android par défaut, plus fluide
                    animation: 'slide_from_right',
                    // en gros on accélère les transitions, 350ms ça sentait lent
                    animationDuration: 100,
                }}
            >
                {!isAuthenticated ? (
                    <>
                        {/* fondu plutôt que glissement pour l'écran de déconnexion */}
                        <Stack.Screen name="Login" component={LoginScreen} options={{ animation: 'fade' }} />
                        <Stack.Screen name="ManualTrackPicker" component={ManualTrackPickerScreen} />
                    </>
                ) : (
                    <>
                        {/* Home en fondu (quitter lobby / déconnexion), pour se
                        distinguer du glissement quand on entre dans un lobby ou une partie */}
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

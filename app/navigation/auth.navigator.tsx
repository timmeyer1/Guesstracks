import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/login.screen';
import { HomeScreen } from '../screens/home.screen';
import { useAuthStore } from '../stores/auth.store';
import LobbyScreen from "../screens/lobby.screen";

const Stack = createNativeStackNavigator();

export const AuthNavigator = () => {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    return (
        <NavigationContainer>
            <Stack.Navigator
                screenOptions={{
                    headerShown: false,
                }}
            >
                {!isAuthenticated ? (
                    <Stack.Screen name="Login" component={LoginScreen} />
                ) : (
                    <>
                        <Stack.Screen name="Home" component={HomeScreen} />
                        <Stack.Screen name="Lobby" component={LobbyScreen} />
                    </>
                )}
            </Stack.Navigator>
        </NavigationContainer>
    );
};

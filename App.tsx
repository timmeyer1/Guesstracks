import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/Navigator';
import {SafeAreaProvider} from "react-native-safe-area-context";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './app/components/ErrorBoundary';


export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthNavigator />
        </ErrorBoundary>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
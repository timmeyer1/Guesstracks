import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/auth.navigator';
import {SafeAreaProvider} from "react-native-safe-area-context";


export default function App() {
  return (
    <SafeAreaProvider>
      <AuthNavigator />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
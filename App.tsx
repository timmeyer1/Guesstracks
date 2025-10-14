import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/auth.navigator';
import { View } from 'react-native';

export default function App() {
  return (
    <View className="flex-1 bg-background">
      <AuthNavigator />
      <StatusBar style="light" />
    </View>
  );
}
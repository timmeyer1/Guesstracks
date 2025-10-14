import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/auth.navigator';

export default function App() {
  return (
    <>
      <AuthNavigator />
      <StatusBar style="auto" /> {/* <--- c pour afficher l'heure, la batterie etc du tel */}
    </>
  );
}
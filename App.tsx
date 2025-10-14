import { StatusBar } from 'expo-status-bar';
import './global.css';
import { AuthNavigator } from './app/navigation/auth.navigator';
import './app/i18n'

export default function App() {
  return (
    <>
      <AuthNavigator />
      <StatusBar style="auto" /> {/* <--- c pour afficher l'heure, la batterie etc du tel */}
    </>
  );
}
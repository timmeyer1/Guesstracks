import { LoginScreen } from '../screens/login.screen';
import { HomeScreen } from '../screens/home.screen';
import { useAuthStore } from '../stores/auth.store';

export const AuthNavigator = () => {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    return isAuthenticated ? <HomeScreen /> : <LoginScreen />;
};
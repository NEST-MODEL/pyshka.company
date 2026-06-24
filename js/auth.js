import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export const AuthModule = {
    currentUser: null,
    currentRole: null,

    // Инициализация слушателя авторизации
    init(onUserLoaded) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                // Получаем роль пользователя из коллекции пользователей в Firestore
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    this.currentRole = userDoc.data().role;
                } else {
                    this.currentRole = "guest"; // Фолбэк, если роль не задана
                }
            } else {
                this.currentUser = null;
                this.currentRole = null;
            }
            onUserLoaded(this.currentUser, this.currentRole);
        });
    },

    // Вход по логину (Email) и паролю
    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            throw new Error(this.mapAuthError(error.code));
        }
    },

    // Выход из системы
    async logout() {
        await signOut(auth);
    },

    // Локализация ошибок Firebase Auth
    mapAuthError(code) {
        switch (code) {
            case 'auth/invalid-email': return 'Неверный формат Email.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential':
                return 'Неверный логин или пароль.';
            default: return 'Ошибка авторизации. Попробуйте снова.';
        }
    }
};

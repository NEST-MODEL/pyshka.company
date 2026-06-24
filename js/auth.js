import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, setDoc, getDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const AuthModule = {
    currentUser: null,
    currentRole: null,
    userData: null,

    init(onUserLoaded) {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                this.currentUser = user;
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    this.userData = userDoc.data();
                    this.currentRole = this.userData.role;
                } else {
                    this.currentRole = "Торговый представитель"; // Роль по умолчанию
                }
            } else {
                this.currentUser = null;
                this.currentRole = null;
                this.userData = null;
            }
            onUserLoaded(this.currentUser, this.currentRole);
        });
    },

    async login(email, password) {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            throw new Error(this.mapAuthError(error.code));
        }
    },

    async register(email, password, name, role) {
        try {
            // Создаем пользователя в Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Сразу же создаем документ в Firestore с привязкой роли
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: name,
                email: email,
                role: role,
                createdAt: new Date().toISOString()
            });
            return user;
        } catch (error) {
            throw new Error(this.mapAuthError(error.code));
        }
    },

    async logout() {
        await signOut(auth);
    },

    mapAuthError(code) {
        switch (code) {
            case 'auth/invalid-email': return 'Неверный формат Email.';
            case 'auth/user-not-found':
            case 'auth/wrong-password':
            case 'auth/invalid-credential': return 'Неверный логин или пароль.';
            case 'auth/email-already-in-reply':
            case 'auth/email-already-in-use': return 'Этот Email уже зарегистрирован в системе.';
            case 'auth/weak-password': return 'Слишком слабый пароль (минимум 6 символов).';
            default: return 'Произошла ошибка. Попробуйте ещё раз.';
        }
    }
};

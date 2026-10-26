import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
    browserLocalPersistence,
    createUserWithEmailAndPassword,
    getAuth,
    getMultiFactorResolver,
    multiFactor,
    sendEmailVerification,
    sendPasswordResetEmail,
    setPersistence,
    signOut,
    signInWithEmailAndPassword,
    TotpMultiFactorGenerator,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const firebaseConfig = window.confortFirebaseConfig;
if (!firebaseConfig) {
    throw new Error('No se encontró la configuración de Firebase para autenticación.');
}

const app = getApps().find(firebaseApp => firebaseApp.name === '[DEFAULT]')
    || initializeApp(firebaseConfig);
const auth = getAuth(app);
const authReady = setPersistence(auth, browserLocalPersistence);
const CONSENT_KEY = 'confort_storage_consent';

let pendingResolver = null;
let pendingTotpSecret = null;
let pendingMfaUser = null;

const showToast = (message, type = 'info') => {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
        return;
    }
    console[type === 'error' ? 'error' : 'info'](message);
};

const hasEssentialStorageConsent = () => localStorage.getItem(CONSENT_KEY) === 'essential-v1';

const requireEssentialStorageConsent = () => {
    if (hasEssentialStorageConsent()) return true;
    showToast('Acepta el almacenamiento esencial para continuar.', 'error');
    document.getElementById('storage-consent')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return false;
};

const showStep = (activeId, relatedIds) => {
    relatedIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.hidden = id !== activeId;
    });
    const active = document.getElementById(activeId);
    const input = active?.querySelector('input');
    if (input) input.focus();
};

const getErrorMessage = (error) => {
    switch (error.code) {
        case 'auth/invalid-email':
            return 'Revisa el formato del correo electrónico.';
        case 'auth/weak-password':
            return 'Elige una contraseña más segura, de al menos 12 caracteres.';
        case 'auth/email-already-in-use':
            return 'No se pudo crear la cuenta. Comprueba los datos o inicia sesión.';
        case 'auth/invalid-credential':
        case 'auth/wrong-password':
        case 'auth/user-not-found':
            return 'No se pudo iniciar sesión con esos datos.';
        case 'auth/too-many-requests':
            return 'Se limitaron temporalmente los intentos. Espera un momento e inténtalo de nuevo.';
        case 'auth/operation-not-allowed':
            return 'El método de acceso todavía no está habilitado en Firebase.';
        case 'auth/unsupported-first-factor':
        case 'auth/unsupported-second-factor':
            return 'La autenticación TOTP no está habilitada para este proyecto de Firebase.';
        default:
            return 'No se pudo completar la autenticación. Inténtalo de nuevo.';
    }
};

const setFormBusy = (form, busy, label) => {
    const button = form.querySelector('[type="submit"]');
    if (!button) return;
    if (busy) {
        button.dataset.originalLabel = button.innerHTML;
        button.disabled = true;
        button.textContent = label;
    } else {
        button.disabled = false;
        if (button.dataset.originalLabel) {
            button.innerHTML = button.dataset.originalLabel;
            delete button.dataset.originalLabel;
        }
    }
};

const saveAuthenticatedUser = async (user) => {
    const token = await user.getIdTokenResult(true);
    const role = token.claims.admin === true || token.claims.role === 'admin' ? 'admin' : 'cliente';
    const profile = {
        uid: user.uid,
        email: user.email,
        username: user.displayName || user.email,
        role,
        createdAt: user.metadata.creationTime || new Date().toISOString()
    };

    localStorage.setItem('confort_current_user', JSON.stringify({
        email: profile.email,
        username: profile.username,
        role,
        uid: user.uid,
        loginAt: new Date().toISOString()
    }));
    localStorage.setItem('confort_user_logged_in', 'true');

    if (typeof window.cloudSaveUser === 'function') {
        try {
            await window.cloudSaveUser(profile);
        } catch (error) {
            console.error('No se pudo guardar el perfil público del usuario:', error);
            showToast('Autenticación completada, pero no se pudo sincronizar el perfil.', 'error');
        }
    }

    const remember = document.getElementById('remember-me');
    if (remember?.checked) {
        localStorage.setItem('confort_remember_email', user.email);
    } else {
        localStorage.removeItem('confort_remember_email');
    }

    showToast(`Bienvenido${profile.username ? `, ${profile.username}` : ''}.`, 'success');
    window.location.replace(role === 'admin' ? 'admin.html' : 'dashboard.html');
};

const beginTotpEnrollment = async (user, mode) => {
    pendingMfaUser = user;
    pendingTotpSecret = await TotpMultiFactorGenerator.generateSecret(
        await multiFactor(user).getSession()
    );

    const prefix = mode === 'register' ? 'register' : 'login';
    const secretElement = document.getElementById(`${prefix}-totp-secret`);
    if (!secretElement) throw new Error('No se encontró el campo para mostrar la clave de configuración TOTP.');

    secretElement.textContent = pendingTotpSecret.secretKey;
    showStep(
        mode === 'register' ? 'register-mfa-enroll' : 'login-mfa-enroll',
        mode === 'register'
            ? ['register-form', 'register-mfa-enroll']
            : ['login-form', 'login-mfa-step', 'login-mfa-enroll']
    );
};

const finishEnrollment = async (form, input, errorElementId, mode) => {
    const code = input.value.trim();
    const errorElement = document.getElementById(errorElementId);
    if (!/^\d{6}$/.test(code)) {
        errorElement.textContent = 'Ingresa el código vigente de 6 dígitos.';
        input.focus();
        return;
    }

    setFormBusy(form, true, 'Verificando código…');
    errorElement.textContent = '';
    try {
        const assertion = TotpMultiFactorGenerator.assertionForEnrollment(pendingTotpSecret, code);
        await multiFactor(pendingMfaUser).enroll(assertion, 'Aplicación autenticadora');
        const user = pendingMfaUser;
        pendingMfaUser = null;
        pendingTotpSecret = null;
        await saveAuthenticatedUser(user);
    } catch (error) {
        console.error('No se pudo completar el enrolamiento TOTP:', error);
        errorElement.textContent = error.code === 'auth/invalid-verification-code'
            ? 'El código no es válido o ya venció. Revisa tu aplicación e inténtalo de nuevo.'
            : getErrorMessage(error);
        setFormBusy(form, false);
        input.select();
        return;
    }

    if (mode === 'register') {
        showToast('Cuenta creada y verificación en dos pasos activada.', 'success');
    }
};

const registerForm = document.getElementById('register-form');
if (registerForm) {
    registerForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!requireEssentialStorageConsent()) return;
        if (!registerForm.reportValidity()) return;

        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmInput = document.getElementById('confirm-password');
        const terms = document.getElementById('terms');
        if (passwordInput.value !== confirmInput.value) {
            confirmInput.setCustomValidity('Las contraseñas no coinciden.');
            confirmInput.reportValidity();
            confirmInput.addEventListener('input', () => confirmInput.setCustomValidity(''), { once: true });
            return;
        }
        if (!terms.checked) {
            terms.reportValidity();
            return;
        }

        setFormBusy(registerForm, true, 'Creando cuenta segura…');
        try {
            await authReady;
            const credential = await createUserWithEmailAndPassword(
                auth,
                emailInput.value.trim().toLowerCase(),
                passwordInput.value
            );
            await updateProfile(credential.user, { displayName: usernameInput.value.trim() });
            await sendEmailVerification(credential.user);
            await signOut(auth);
            showToast('Cuenta creada. Revisa tu correo y verifica la dirección antes de iniciar sesión.', 'success');
        } catch (error) {
            console.error('No se pudo crear la cuenta Firebase:', error);
            if (auth.currentUser && !multiFactor(auth.currentUser).enrolledFactors.length) {
                try {
                    await auth.signOut();
                } catch (signOutError) {
                    console.error('No se pudo cerrar la sesión incompleta:', signOutError);
                }
            }
            showToast(getErrorMessage(error), 'error');
            setFormBusy(registerForm, false);
        }
    });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!requireEssentialStorageConsent()) return;
        if (!loginForm.reportValidity()) return;

        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        setFormBusy(loginForm, true, 'Verificando credenciales…');
        try {
            await authReady;
            const credential = await signInWithEmailAndPassword(auth, email, password);
            if (!credential.user.emailVerified) {
                await sendEmailVerification(credential.user);
                await signOut(auth);
                showToast('Te reenviamos el enlace de verificación. Revisa tu correo antes de iniciar sesión.', 'info');
                setFormBusy(loginForm, false);
                return;
            }
            if (multiFactor(credential.user).enrolledFactors.length === 0) {
                await beginTotpEnrollment(credential.user, 'login');
                showToast('Configura la aplicación autenticadora para completar el acceso.', 'info');
                return;
            }
            await saveAuthenticatedUser(credential.user);
        } catch (error) {
            if (error.code === 'auth/multi-factor-auth-required') {
                try {
                    pendingResolver = getMultiFactorResolver(auth, error);
                    const totpHint = pendingResolver.hints.find(
                        hint => hint.factorId === TotpMultiFactorGenerator.FACTOR_ID
                    );
                    if (!totpHint) throw new Error('La cuenta no tiene un factor TOTP disponible.');
                    loginForm.hidden = true;
                    const mfaStep = document.getElementById('login-mfa-step');
                    if (mfaStep) mfaStep.hidden = false;
                    document.getElementById('login-mfa-code')?.focus();
                    return;
                } catch (resolverError) {
                    console.error('No se pudo iniciar el desafío MFA:', resolverError);
                    showToast(getErrorMessage(resolverError), 'error');
                    setFormBusy(loginForm, false);
                    return;
                }
            }
            console.error('No se pudo iniciar sesión con Firebase:', error);
            showToast(getErrorMessage(error), 'error');
            setFormBusy(loginForm, false);
        }
    });
}

const loginMfaForm = document.getElementById('login-mfa-form');
if (loginMfaForm) {
    loginMfaForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!requireEssentialStorageConsent()) return;
        if (!loginMfaForm.reportValidity()) return;
        const codeInput = document.getElementById('login-mfa-code');
        const errorElement = document.getElementById('login-mfa-error');
        const code = codeInput.value.trim();
        if (!/^\d{6}$/.test(code)) {
            errorElement.textContent = 'Ingresa el código vigente de 6 dígitos.';
            codeInput.focus();
            return;
        }

        setFormBusy(loginMfaForm, true, 'Verificando código…');
        errorElement.textContent = '';
        try {
            const hint = pendingResolver.hints.find(
                item => item.factorId === TotpMultiFactorGenerator.FACTOR_ID
            );
            const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, code);
            const credential = await pendingResolver.resolveSignIn(assertion);
            pendingResolver = null;
            await saveAuthenticatedUser(credential.user);
        } catch (error) {
            console.error('No se pudo verificar el segundo factor:', error);
            errorElement.textContent = error.code === 'auth/invalid-verification-code'
                ? 'El código no es válido o ya venció. Inténtalo de nuevo.'
                : getErrorMessage(error);
            setFormBusy(loginMfaForm, false);
            codeInput.select();
        }
    });
}

const registerTotpForm = document.getElementById('register-totp-form');
if (registerTotpForm) {
    registerTotpForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!requireEssentialStorageConsent()) return;
        if (!registerTotpForm.reportValidity()) return;
        await finishEnrollment(
            registerTotpForm,
            document.getElementById('register-totp-code'),
            'register-totp-error',
            'register'
        );
    });
}

const loginTotpForm = document.getElementById('login-totp-enroll-form');
if (loginTotpForm) {
    loginTotpForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!requireEssentialStorageConsent()) return;
        if (!loginTotpForm.reportValidity()) return;
        await finishEnrollment(
            loginTotpForm,
            document.getElementById('login-totp-code'),
            'login-totp-error',
            'login'
        );
    });
}

const forgotPasswordButton = document.getElementById('forgot-password-link');
if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener('click', event => {
        event.preventDefault();
        const modal = document.getElementById('forgot-modal');
        if (modal) modal.style.display = 'flex';
    });
}

window.sendAuthPasswordReset = async email => {
    if (!requireEssentialStorageConsent()) return;
    const message = document.getElementById('forgot-reset-message');
    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error('No se pudo solicitar el restablecimiento:', error);
    }
    if (message) message.textContent = 'Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.';
};

const rememberedEmail = localStorage.getItem('confort_remember_email');
const emailInput = document.getElementById('email');
const rememberCheckbox = document.getElementById('remember-me');
if (rememberedEmail && emailInput) {
    emailInput.value = rememberedEmail;
    if (rememberCheckbox) rememberCheckbox.checked = true;
}

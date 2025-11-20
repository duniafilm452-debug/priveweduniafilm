import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const elements = {
    // Mode selector
    modeBtns: document.querySelectorAll('.mode-btn'),
    modeSelector: document.querySelector('.mode-selector'),
    userTabs: document.getElementById('user-tabs'),
    socialLogin: document.getElementById('social-login'),
    loginSubtitle: document.getElementById('login-subtitle'),
    
    // Forms
    adminForm: document.getElementById('admin-form'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    
    // Tab buttons
    tabBtns: document.querySelectorAll('.tab-btn'),
    
    // Admin form
    adminEmail: document.getElementById('admin-email'),
    adminPassword: document.getElementById('admin-password'),
    adminBtn: document.querySelector('.admin-btn'),
    adminText: document.getElementById('admin-text'),
    adminSpinner: document.getElementById('admin-spinner'),
    
    // User login form
    loginEmail: document.getElementById('login-email'),
    loginPassword: document.getElementById('login-password'),
    loginBtn: document.querySelector('#login-form .submit-btn'),
    loginText: document.getElementById('login-text'),
    loginSpinner: document.getElementById('login-spinner'),
    
    // User register form
    registerEmail: document.getElementById('register-email'),
    registerPassword: document.getElementById('register-password'),
    confirmPassword: document.getElementById('confirm-password'),
    username: document.getElementById('username'),
    agreeTerms: document.getElementById('agree-terms'),
    registerBtn: document.querySelector('#register-form .submit-btn'),
    registerText: document.getElementById('register-text'),
    registerSpinner: document.getElementById('register-spinner'),
    
    // Popups
    successPopup: document.getElementById('success-popup'),
    errorPopup: document.getElementById('error-popup'),
    loadingOverlay: document.getElementById('loading-overlay'),
    successOk: document.getElementById('success-ok'),
    errorOk: document.getElementById('error-ok'),
    successTitle: document.getElementById('success-title'),
    successMessage: document.getElementById('success-message'),
    errorMessage: document.getElementById('error-message'),
    loadingText: document.getElementById('loading-text')
};

// Current mode
let currentMode = 'user';

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
});

// Fungsi inisialisasi
function initializeApp() {
    // Cek jika user sudah login
    checkCurrentSession();
}

// Setup event listeners
function setupEventListeners() {
    // Mode switching
    elements.modeBtns.forEach(btn => {
        btn.addEventListener('click', () => switchMode(btn.dataset.mode));
    });
    
    // Tab switching (hanya untuk user mode)
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    // Form submissions
    elements.adminForm.addEventListener('submit', handleAdminLogin);
    elements.loginForm.addEventListener('submit', handleUserLogin);
    elements.registerForm.addEventListener('submit', handleUserRegister);
    
    // Popup buttons
    elements.successOk.addEventListener('click', () => hidePopup('success'));
    elements.errorOk.addEventListener('click', () => hidePopup('error'));
    
    // Real-time validation
    elements.confirmPassword?.addEventListener('input', validatePasswordMatch);
    elements.registerPassword?.addEventListener('input', validatePasswordMatch);
    
    // Social login buttons
    setupSocialLogin();
}

// Cek session saat ini
async function checkCurrentSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // User sudah login, redirect berdasarkan role
        await redirectBasedOnRole(session.user);
    }
}

// Redirect berdasarkan role user
async function redirectBasedOnRole(user) {
    try {
        const userRole = user.user_metadata?.role || 'user';
        
        if (userRole === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'index.html';
        }
    } catch (error) {
        console.error('Error redirecting based on role:', error);
    }
}

// Switch mode (User/Admin)
function switchMode(mode) {
    currentMode = mode;
    
    // Update mode buttons
    elements.modeBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Update UI berdasarkan mode
    if (mode === 'admin') {
        // Admin mode
        elements.userTabs.classList.add('hidden');
        elements.socialLogin.classList.add('hidden');
        elements.adminForm.classList.add('active');
        elements.loginForm.classList.remove('active');
        elements.registerForm.classList.remove('active');
        elements.loginSubtitle.textContent = 'Login sebagai Administrator';
    } else {
        // User mode
        elements.userTabs.classList.remove('hidden');
        elements.socialLogin.classList.remove('hidden');
        elements.adminForm.classList.remove('active');
        elements.loginForm.classList.add('active');
        elements.registerForm.classList.remove('active');
        elements.loginSubtitle.textContent = 'Masuk ke akun Anda';
    }
    
    // Reset semua form
    resetAllForms();
}

// Switch tab (Login/Register)
function switchTab(tab) {
    // Update tab buttons
    elements.tabBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    // Update forms
    elements.loginForm.classList.toggle('active', tab === 'login');
    elements.registerForm.classList.toggle('active', tab === 'register');
    
    // Reset forms
    if (tab === 'login') {
        elements.registerForm.reset();
    } else {
        elements.loginForm.reset();
    }
}

// Validasi password match
function validatePasswordMatch() {
    const password = elements.registerPassword.value;
    const confirm = elements.confirmPassword.value;
    
    if (confirm && password !== confirm) {
        elements.confirmPassword.classList.add('error');
        return false;
    } else {
        elements.confirmPassword.classList.remove('error');
        return true;
    }
}

// Handle admin login
async function handleAdminLogin(e) {
    e.preventDefault();
    
    const email = elements.adminEmail.value.trim();
    const password = elements.adminPassword.value.trim();
    
    if (!email || !password) {
        showError('Email dan password harus diisi');
        return;
    }
    
    await performAdminLogin(email, password);
}

// Perform admin login
async function performAdminLogin(email, password) {
    showLoading('Login sebagai admin...');
    disableForm('admin', true);
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            throw error;
        }
        
        // Cek apakah user adalah admin
        const userRole = data.user.user_metadata?.role || 'user';
        
        if (userRole !== 'admin') {
            // Logout user biasa yang mencoba login sebagai admin
            await supabase.auth.signOut();
            throw new Error('Anda bukan administrator. Silakan login sebagai user biasa.');
        }
        
        // Admin login berhasil
        showSuccess('Login Admin Berhasil', 'Selamat datang di Admin Panel!');
        
        // Redirect ke admin panel setelah 2 detik
        setTimeout(() => {
            window.location.href = 'admin.html';
        }, 2000);
        
    } catch (error) {
        console.error('Admin login error:', error);
        
        if (error.message.includes('Invalid login credentials')) {
            showError('Email atau password admin salah');
        } else if (error.message.includes('Anda bukan administrator')) {
            showError(error.message);
        } else {
            showError('Terjadi kesalahan saat login admin: ' + error.message);
        }
    } finally {
        hideLoading();
        disableForm('admin', false);
    }
}

// Handle user login
async function handleUserLogin(e) {
    e.preventDefault();
    
    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value.trim();
    
    if (!email || !password) {
        showError('Email dan password harus diisi');
        return;
    }
    
    await performUserLogin(email, password);
}

// Perform user login
async function performUserLogin(email, password) {
    showLoading('Masuk ke akun...');
    disableForm('login', true);
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) {
            throw error;
        }
        
        // Cek role user
        const userRole = data.user.user_metadata?.role || 'user';
        
        if (userRole === 'admin') {
            // Admin mencoba login di user mode, redirect ke admin
            showSuccess('Login Berhasil', 'Mengarahkan ke Admin Panel...');
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 2000);
        } else {
            // User biasa login berhasil
            showSuccess('Login Berhasil', 'Selamat datang kembali!');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
        }
        
    } catch (error) {
        console.error('User login error:', error);
        
        if (error.message.includes('Invalid login credentials')) {
            showError('Email atau password salah');
        } else if (error.message.includes('Email not confirmed')) {
            showError('Email belum dikonfirmasi. Silakan cek email Anda.');
        } else {
            showError('Terjadi kesalahan saat login: ' + error.message);
        }
    } finally {
        hideLoading();
        disableForm('login', false);
    }
}

// Handle user register
async function handleUserRegister(e) {
    e.preventDefault();
    
    const email = elements.registerEmail.value.trim();
    const password = elements.registerPassword.value.trim();
    const confirm = elements.confirmPassword.value.trim();
    const username = elements.username.value.trim();
    
    // Validasi
    if (!email || !password || !confirm || !username) {
        showError('Semua field harus diisi');
        return;
    }
    
    if (password.length < 6) {
        showError('Password harus minimal 6 karakter');
        return;
    }
    
    if (!validatePasswordMatch()) {
        showError('Password dan konfirmasi password tidak cocok');
        return;
    }
    
    if (!elements.agreeTerms.checked) {
        showError('Anda harus menyetujui Syarat & Ketentuan');
        return;
    }
    
    await performUserRegistration(email, password, username);
}

// Perform user registration
async function performUserRegistration(email, password, username) {
    showLoading('Membuat akun...');
    disableForm('register', true);
    
    try {
        // Daftarkan user di Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username,
                    role: 'user' // Set default role sebagai user
                }
            }
        });
        
        if (authError) {
            throw authError;
        }
        
        // Buat profile di database (akan ditrigger oleh database trigger)
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Update username di profile jika perlu
        if (authData.user) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ username: username })
                .eq('id', authData.user.id);
                
            if (profileError && !profileError.message.includes('duplicate key')) {
                console.warn('Profile update warning:', profileError);
            }
        }
        
        // Registrasi berhasil
        showSuccess(
            'Registrasi Berhasil!', 
            'Akun Anda telah berhasil dibuat. Silakan cek email untuk verifikasi (jika diperlukan).'
        );
        
        // Switch ke tab login setelah 3 detik
        setTimeout(() => {
            hidePopup('success');
            switchTab('login');
        }, 3000);
        
    } catch (error) {
        console.error('Registration error:', error);
        
        // Handle specific error cases
        if (error.message.includes('already registered')) {
            showError('Email sudah terdaftar. Silakan gunakan email lain.');
        } else if (error.message.includes('weak password')) {
            showError('Password terlalu lemah. Gunakan password yang lebih kuat.');
        } else if (error.message.includes('invalid email')) {
            showError('Format email tidak valid');
        } else {
            showError('Terjadi kesalahan saat mendaftar: ' + error.message);
        }
    } finally {
        hideLoading();
        disableForm('register', false);
    }
}

// Social login
function setupSocialLogin() {
    // Google login
    document.querySelector('.google-btn')?.addEventListener('click', async () => {
        showError('Login dengan Google belum tersedia');
    });
    
    // GitHub login
    document.querySelector('.github-btn')?.addEventListener('click', async () => {
        showError('Login dengan GitHub belum tersedia');
    });
}

// Utility functions
function resetAllForms() {
    elements.adminForm.reset();
    elements.loginForm.reset();
    elements.registerForm.reset();
}

function disableForm(formType, disabled) {
    let form, btn, text, spinner;
    
    switch (formType) {
        case 'admin':
            form = elements.adminForm;
            btn = elements.adminBtn;
            text = elements.adminText;
            spinner = elements.adminSpinner;
            break;
        case 'login':
            form = elements.loginForm;
            btn = elements.loginBtn;
            text = elements.loginText;
            spinner = elements.loginSpinner;
            break;
        case 'register':
            form = elements.registerForm;
            btn = elements.registerBtn;
            text = elements.registerText;
            spinner = elements.registerSpinner;
            break;
    }
    
    const inputs = form.querySelectorAll('input, button');
    inputs.forEach(input => {
        if (input !== btn) {
            input.disabled = disabled;
        }
    });
    
    if (disabled) {
        const loadingTexts = {
            'admin': 'Login...',
            'login': 'Memproses...',
            'register': 'Mendaftarkan...'
        };
        text.textContent = loadingTexts[formType];
        spinner.classList.remove('hidden');
        btn.disabled = true;
    } else {
        const normalTexts = {
            'admin': 'Login sebagai Admin',
            'login': 'Masuk',
            'register': 'Daftar'
        };
        text.textContent = normalTexts[formType];
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
}

function showLoading(message = 'Memproses...') {
    elements.loadingText.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function showPopup(type) {
    elements[`${type}Popup`].classList.remove('hidden');
}

function hidePopup(type) {
    elements[`${type}Popup`].classList.add('hidden');
}

function showSuccess(title, message) {
    elements.successTitle.textContent = title;
    elements.successMessage.textContent = message;
    showPopup('success');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showPopup('error');
}
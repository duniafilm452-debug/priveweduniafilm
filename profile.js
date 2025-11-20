import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Supabase setup
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// DOM Elements
const usernameEl = document.getElementById("username");
const emailEl = document.getElementById("email");
const avatarImg = document.getElementById("avatar-img");
const historyList = document.getElementById("history-list");
const favoritesList = document.getElementById("favorites-list");
const loginBtnHeader = document.getElementById("login-btn-header");
const logoutBtn = document.getElementById("logout-btn");
const editProfileBtn = document.getElementById("edit-profile-btn");
const viewAllHistoryBtn = document.getElementById("view-all-history");
const viewAllFavoritesBtn = document.getElementById("view-all-favorites");

const editModal = document.getElementById("edit-modal");
const editUsernameInput = document.getElementById("edit-username");
const saveProfileBtn = document.getElementById("save-profile-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");

const avatarUpload = document.getElementById("avatar-upload");
const avatarEditLabel = document.querySelector('.avatar-edit');

let currentUser = null;

// 🚀 Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Fungsi inisialisasi aplikasi
async function initializeApp() {
    // Cek session yang aktif
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error('Error checking session:', error);
        setGuestView();
        return;
    }

    if (!session) {
        setGuestView();
        return;
    }

    currentUser = session.user;
    await ensureProfile(currentUser);
    await loadProfile();
    updateAuthUI(true);
}

// 👤 Set view untuk tamu
function setGuestView() {
    usernameEl.textContent = "Tamu";
    emailEl.textContent = "Login untuk melihat detail.";
    avatarImg.src = "https://placehold.co/100x100?text=Avatar";
    historyList.innerHTML = '<p class="empty-text">Belum ada riwayat tontonan.</p>';
    favoritesList.innerHTML = '<p class="empty-text">Belum ada favorit.</p>';
    updateAuthUI(false);
}

// 🔧 Pastikan row profile ada di tabel
async function ensureProfile(user) {
    try {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Profile tidak ditemukan, buat baru
            const { error: insertError } = await supabase
                .from("profiles")
                .insert({ 
                    id: user.id, 
                    email: user.email, 
                    username: user.email.split('@')[0] || "Pengguna"
                });

            if (insertError) {
                console.error('Error creating profile:', insertError);
            } else {
                console.log('Profile created successfully');
            }
        } else if (error) {
            console.error('Error checking profile:', error);
        } else {
            console.log('Profile found:', data);
        }
    } catch (error) {
        console.error('Exception in ensureProfile:', error);
    }
}

// 🔄 Load data profil
async function loadProfile() {
    try {
        const { data: profile, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", currentUser.id)
            .single();

        if (error) {
            console.error('Error loading profile:', error);
            return;
        }

        if (profile) {
            usernameEl.textContent = profile.username || "Pengguna";
            emailEl.textContent = profile.email || currentUser.email;
            
            if (profile.avatar_url) {
                avatarImg.src = profile.avatar_url + '?t=' + Date.now();
                console.log('Avatar loaded:', profile.avatar_url);
            } else {
                avatarImg.src = "https://placehold.co/100x100?text=Avatar";
            }
        }

        await loadHistory();
        await loadFavorites();
    } catch (error) {
        console.error('Exception in loadProfile:', error);
    }
}

// 📜 Load riwayat tonton
async function loadHistory() {
    try {
        const { data, error } = await supabase
            .from("watch_history")
            .select("movie_id, movies(title, thumbnail_url)")
            .eq("user_id", currentUser?.id)
            .order("watched_at", { ascending: false })
            .limit(10);

        if (error) {
            console.error('Error loading history:', error);
            return;
        }

        if (!data || data.length === 0) {
            historyList.innerHTML = '<p class="empty-text">Belum ada riwayat tontonan.</p>';
            return;
        }

        historyList.innerHTML = data.map(item => `
            <div class="history-item" onclick="window.location.href='detail.html?id=${item.movie_id}'">
                <img src="${item.movies.thumbnail_url || 'https://placehold.co/120x160?text=No+Image'}" 
                     alt="${item.movies.title}"
                     onerror="this.src='https://placehold.co/120x160?text=No+Image'">
                <p>${item.movies.title}</p>
            </div>
        `).join("");
    } catch (error) {
        console.error('Exception in loadHistory:', error);
    }
}

// ⭐ Load favorit
async function loadFavorites() {
    try {
        const { data, error } = await supabase
            .from("favorites")
            .select("movie_id, movies(title, thumbnail_url)")
            .eq("user_id", currentUser?.id)
            .limit(10);

        if (error) {
            console.error('Error loading favorites:', error);
            return;
        }

        if (!data || data.length === 0) {
            favoritesList.innerHTML = '<p class="empty-text">Belum ada favorit.</p>';
            return;
        }

        favoritesList.innerHTML = data.map(item => `
            <div class="favorite-item" onclick="window.location.href='detail.html?id=${item.movie_id}'">
                <img src="${item.movies.thumbnail_url || 'https://placehold.co/120x160?text=No+Image'}" 
                     alt="${item.movies.title}"
                     onerror="this.src='https://placehold.co/120x160?text=No+Image'">
                <p>${item.movies.title}</p>
            </div>
        `).join("");
    } catch (error) {
        console.error('Exception in loadFavorites:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Login/Logout
    loginBtnHeader.addEventListener('click', redirectToLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Edit profil
    editProfileBtn.addEventListener('click', showEditModal);
    saveProfileBtn.addEventListener('click', saveProfile);
    cancelEditBtn.addEventListener('click', hideEditModal);
    
    // View All buttons
    viewAllHistoryBtn.addEventListener('click', () => redirectToHistory());
    viewAllFavoritesBtn.addEventListener('click', () => redirectToFavorites());
    
    // Upload avatar
    avatarUpload.addEventListener('change', handleAvatarUpload);
    
    // Modal backdrop click
    editModal.addEventListener('click', function(e) {
        if (e.target === editModal) hideEditModal();
    });
    
    // Keyboard events
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            hideEditModal();
        }
    });

    // Listen untuk perubahan auth state
    supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await ensureProfile(currentUser);
            await loadProfile();
            updateAuthUI(true);
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            setGuestView();
        } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed');
        }
    });
}

// Update UI berdasarkan status auth
function updateAuthUI(isLoggedIn) {
    if (isLoggedIn) {
        loginBtnHeader.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        editProfileBtn.classList.remove('hidden');
        viewAllHistoryBtn.classList.remove('hidden');
        viewAllFavoritesBtn.classList.remove('hidden');
    } else {
        loginBtnHeader.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        editProfileBtn.classList.add('hidden');
        viewAllHistoryBtn.classList.add('hidden');
        viewAllFavoritesBtn.classList.add('hidden');
    }
}

// 🔗 Redirect ke halaman login
function redirectToLogin() {
    window.location.href = 'login.html';
}

// 🔗 Redirect ke halaman riwayat lengkap
function redirectToHistory() {
    if (!currentUser) {
        redirectToLogin();
        return;
    }
    window.location.href = 'history.html';
}

// 🔗 Redirect ke halaman favorit lengkap
function redirectToFavorites() {
    if (!currentUser) {
        redirectToLogin();
        return;
    }
    window.location.href = 'favorites.html';
}

// ✏️ Edit profil
function showEditModal() {
    if (!currentUser) {
        redirectToLogin();
        return;
    }
    editModal.classList.remove("hidden");
    editUsernameInput.value = usernameEl.textContent;
    editUsernameInput.focus();
}

function hideEditModal() {
    editModal.classList.add("hidden");
}

async function saveProfile() {
    const newUsername = editUsernameInput.value.trim();
    if (!newUsername) {
        alert("Nama tidak boleh kosong.");
        return;
    }

    try {
        const { error } = await supabase
            .from("profiles")
            .update({ username: newUsername })
            .eq("id", currentUser.id);

        if (error) {
            alert("Gagal memperbarui profil: " + error.message);
            return;
        }

        usernameEl.textContent = newUsername;
        alert("Profil berhasil diperbarui!");
        hideEditModal();
    } catch (error) {
        console.error('Error saving profile:', error);
        alert("Terjadi kesalahan saat memperbarui profil.");
    }
}

// 🖼 Upload avatar
async function handleAvatarUpload(e) {
    if (!currentUser) {
        redirectToLogin();
        return;
    }

    const file = e.target.files[0];
    if (!file) {
        console.log('No file selected');
        return;
    }

    console.log('File selected:', file.name, file.size, file.type);

    // Validasi file
    if (!file.type.startsWith('image/')) {
        alert('Harap pilih file gambar yang valid (JPEG, PNG, dll).');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('Ukuran file terlalu besar. Maksimal 5MB.');
        return;
    }

    try {
        // Tampilkan loading state
        if (avatarEditLabel) {
            avatarEditLabel.textContent = 'Mengunggah...';
            avatarEditLabel.style.backgroundColor = '#ff6b6b';
        }

        // Buat nama file unik
        const fileExtension = file.name.split('.').pop();
        const fileName = `${currentUser.id}/avatars${Date.now()}.${fileExtension}`;
        
        console.log('Uploading to:', fileName);

        // 1. Upload file ke storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from("avatars")
            .upload(fileName, file, { 
                upsert: true,
                cacheControl: '3600'
            });

        if (uploadError) {
            console.error('Upload error details:', uploadError);
            
            // Cek jika bucket avatars ada
            if (uploadError.message.includes('bucket') || uploadError.message.includes('not found')) {
                alert('Error: Bucket "avatars" tidak ditemukan. Pastikan bucket sudah dibuat di Supabase Storage.');
            } else {
                alert(`Upload gagal: ${uploadError.message}`);
            }
            return;
        }

        console.log('Upload successful:', uploadData);

        // 2. Dapatkan URL public
        const { data: { publicUrl } } = supabase.storage
            .from("avatars")
            .getPublicUrl(fileName);

        console.log('Public URL:', publicUrl);

        // 3. Update profile dengan avatar URL baru
        const { error: updateError } = await supabase
            .from("profiles")
            .update({ 
                avatar_url: publicUrl,
                updated_at: new Date().toISOString()
            })
            .eq("id", currentUser.id);

        if (updateError) {
            console.error('Update profile error:', updateError);
            alert("Gagal menyimpan avatar ke profil: " + updateError.message);
            return;
        }

        // 4. Update gambar avatar dengan cache busting
        avatarImg.src = publicUrl + '?t=' + Date.now();
        
        // 5. Tampilkan notifikasi sukses
        alert("✅ Avatar berhasil diunggah!");
        
        console.log('Avatar update completed successfully');

    } catch (error) {
        console.error('Unexpected error in avatar upload:', error);
        alert("Terjadi kesalahan tak terduga: " + error.message);
    } finally {
        // Reset state dan input file
        if (avatarEditLabel) {
            avatarEditLabel.textContent = 'Ubah';
            avatarEditLabel.style.backgroundColor = '';
        }
        e.target.value = '';
    }
}

// 🚪 Logout
async function handleLogout() {
    if (!confirm('Apakah Anda yakin ingin keluar?')) {
        return;
    }

    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            throw error;
        }
        
        currentUser = null;
        setGuestView();
        
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);
        
    } catch (error) {
        console.error('Error during logout:', error);
        alert('Terjadi kesalahan saat logout: ' + error.message);
    }
}

// Refresh token secara periodic untuk mencegah logout otomatis
setInterval(async () => {
    if (currentUser) {
        try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) {
                console.warn('Token refresh failed:', error);
            } else {
                console.log('Token refreshed successfully');
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
        }
    }
}, 30 * 60 * 1000); // Refresh setiap 30 menit
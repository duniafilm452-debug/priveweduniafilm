import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const elements = {
    // Dashboard elements
    totalMovies: document.getElementById('total-movies'),
    totalViews: document.getElementById('total-views'),
    totalUsers: document.getElementById('total-users'),
    totalLikes: document.getElementById('total-likes'),
    adminNameDisplay: document.getElementById('admin-name-display'),
    viewsChart: document.getElementById('views-chart'),
    categoryChart: document.getElementById('category-chart'),
    viewsPeriod: document.getElementById('views-period'),
    activityList: document.getElementById('activity-list'),
    refreshActivity: document.getElementById('refresh-activity'),
    topMoviesList: document.getElementById('top-movies-list'),
    
    // Upload form elements
    uploadForm: document.getElementById('upload-form'),
    movieTitle: document.getElementById('movie-title'),
    movieDesc: document.getElementById('movie-desc'),
    movieCategory: document.getElementById('movie-category'),
    videoUrl: document.getElementById('video-url'),
    movieDuration: document.getElementById('movie-duration'),
    thumbnailUpload: document.getElementById('thumbnail-upload'),
    thumbnailUploadArea: document.getElementById('thumbnail-upload-area'),
    thumbnailPreview: document.getElementById('thumbnail-preview'),
    thumbnailUrl: document.getElementById('thumbnail-url'),
    uploadPreview: document.querySelector('.upload-preview'),
    uploadPlaceholder: document.querySelector('.upload-placeholder'),
    changeThumbnail: document.getElementById('change-thumbnail'),
    
    // Filter elements
    categoryFilter: document.getElementById('category-filter'),
    
    // Buttons
    submitBtn: document.getElementById('submit-btn'),
    submitText: document.getElementById('submit-text'),
    submitSpinner: document.getElementById('submit-spinner'),
    resetBtn: document.getElementById('reset-btn'),
    
    // Popups
    successPopup: document.getElementById('success-popup'),
    errorPopup: document.getElementById('error-popup'),
    loadingOverlay: document.getElementById('loading-overlay'),
    successOk: document.getElementById('success-ok'),
    successView: document.getElementById('success-view'),
    errorOk: document.getElementById('error-ok'),
    
    // Messages
    successMessage: document.getElementById('success-message'),
    errorMessage: document.getElementById('error-message'),
    
    // Access denied
    accessDenied: document.getElementById('access-denied')
};

let uploadedMovieId = null;
let currentThumbnailFile = null;
let allMovies = [];
let editingMovieId = null;
let editThumbnailFiles = {};
let viewsChartInstance = null;
let categoryChartInstance = null;
let countdownInterval = null;

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
});

// Fungsi inisialisasi dengan security check
async function initializeApp() {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
        console.error('Error checking session:', error);
        showError('Gagal memeriksa sesi');
        return;
    }

    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // CEK APAKAH USER ADALAH ADMIN
    const isUserAdmin = await checkIfUserIsAdmin(session.user.id);
    
    if (!isUserAdmin) {
        showAccessDenied();
        return;
    }

    // User adalah admin, lanjutkan inisialisasi
    elements.adminNameDisplay.textContent = session.user.email || 'Admin';
    setupEventListeners();
    await loadDashboardData();
}

// Fungsi untuk mengecek apakah user adalah admin
async function checkIfUserIsAdmin(userId) {
    try {
        // Cek dari user metadata terlebih dahulu
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.role === 'admin') {
            return true;
        }
        
        // Cek dari tabel profiles
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single();
            
        if (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
        
        return profile?.role === 'admin';
    } catch (error) {
        console.error('Error in checkIfUserIsAdmin:', error);
        return false;
    }
}

// Tampilkan akses ditolak
function showAccessDenied() {
    elements.accessDenied.classList.remove('hidden');
    
    // Sembunyikan semua section
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Sembunyikan tabs
    document.querySelector('.admin-tabs').classList.add('hidden');
    
    // Start countdown
    let countdown = 5;
    const countdownElement = document.getElementById('countdown');
    
    countdownInterval = setInterval(() => {
        countdown--;
        countdownElement.textContent = countdown;
        
        if (countdown <= 0) {
            redirectToHome();
        }
    }, 1000);
}

// Redirect ke home
function redirectToHome() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    window.location.href = 'login.html';
}

// Setup event listeners
function setupEventListeners() {
    // Dashboard events
    elements.refreshActivity.addEventListener('click', loadRecentActivity);
    elements.viewsPeriod.addEventListener('change', loadViewsChart);
    
    // Upload form events
    elements.uploadForm.addEventListener('submit', handleFormSubmit);
    elements.thumbnailUploadArea.addEventListener('click', () => elements.thumbnailUpload.click());
    elements.thumbnailUpload.addEventListener('change', handleThumbnailUpload);
    elements.changeThumbnail.addEventListener('click', () => elements.thumbnailUpload.click());
    elements.thumbnailUrl.addEventListener('input', handleThumbnailUrlInput);
    elements.categoryFilter.addEventListener('change', filterMovies);
    elements.resetBtn.addEventListener('click', resetForm);
    
    // Drag and drop untuk thumbnail
    elements.thumbnailUploadArea.addEventListener('dragover', handleDragOver);
    elements.thumbnailUploadArea.addEventListener('dragleave', handleDragLeave);
    elements.thumbnailUploadArea.addEventListener('drop', handleDrop);
    
    // Input validation
    elements.videoUrl.addEventListener('input', validateVideoUrl);
    
    // Popup buttons
    elements.successOk.addEventListener('click', () => hidePopup('success'));
    elements.successView.addEventListener('click', viewUploadedMovie);
    elements.errorOk.addEventListener('click', () => hidePopup('error'));
}

// ===============================
// DASHBOARD FUNCTIONS
// ===============================

// Load semua data dashboard
async function loadDashboardData() {
    showLoading();
    
    try {
        await Promise.all([
            loadQuickStats(),
            loadViewsChart(),
            loadCategoryChart(),
            loadRecentActivity(),
            loadTopMovies()
        ]);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showError('Gagal memuat data dashboard');
    } finally {
        hideLoading();
    }
}

// Load quick stats
async function loadQuickStats() {
    try {
        // Total Movies
        const { count: moviesCount, error: moviesError } = await supabase
            .from('movies')
            .select('*', { count: 'exact', head: true });
            
        if (!moviesError) {
            elements.totalMovies.textContent = moviesCount || 0;
        }
        
        // Total Views
        const { data: viewsData, error: viewsError } = await supabase
            .from('movies')
            .select('views');
            
        if (!viewsError) {
            const totalViews = viewsData.reduce((sum, movie) => sum + (movie.views || 0), 0);
            elements.totalViews.textContent = totalViews.toLocaleString();
        }
        
        // Total Users
        const { count: usersCount, error: usersError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
            
        if (!usersError) {
            elements.totalUsers.textContent = usersCount || 0;
        }
        
        // Total Likes
        const { count: likesCount, error: likesError } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true });
            
        if (!likesError) {
            elements.totalLikes.textContent = likesCount || 0;
        }
        
    } catch (error) {
        console.error('Error loading quick stats:', error);
    }
}

// Load views chart
async function loadViewsChart() {
    try {
        const period = elements.viewsPeriod.value;
        let days = 7;
        
        switch (period) {
            case '30days': days = 30; break;
            case '90days': days = 90; break;
            default: days = 7;
        }
        
        const { data: recentMovies, error } = await supabase
            .from('movies')
            .select('views, created_at')
            .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: true });
            
        if (error) throw error;
        
        // Process data for chart
        const labels = [];
        const viewsData = [];
        
        // Group by date (simplified)
        const dailyData = {};
        recentMovies?.forEach(movie => {
            const date = new Date(movie.created_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short'
            });
            dailyData[date] = (dailyData[date] || 0) + (movie.views || 0);
        });
        
        Object.keys(dailyData).forEach(date => {
            labels.push(date);
            viewsData.push(dailyData[date]);
        });
        
        // Create or update chart
        const ctx = elements.viewsChart.getContext('2d');
        
        if (viewsChartInstance) {
            viewsChartInstance.destroy();
        }
        
        viewsChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Tayangan',
                    data: viewsData,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading views chart:', error);
        createSampleViewsChart();
    }
}

// Create sample views chart (fallback)
function createSampleViewsChart() {
    const ctx = elements.viewsChart.getContext('2d');
    const labels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    const data = [1200, 1900, 1500, 2200, 1800, 2500, 2100];
    
    viewsChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Tayangan',
                data: data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

// Load category chart
async function loadCategoryChart() {
    try {
        const { data: movies, error } = await supabase
            .from('movies')
            .select('category');
            
        if (error) throw error;
        
        // Count movies by category
        const categoryCount = {};
        movies?.forEach(movie => {
            const category = movie.category || 'Lainnya';
            categoryCount[category] = (categoryCount[category] || 0) + 1;
        });
        
        const labels = Object.keys(categoryCount);
        const data = Object.values(categoryCount);
        const backgroundColors = [
            '#667eea', '#764ba2', '#f093fb', '#4CAF50', '#FF9800', '#E91E63'
        ];
        
        const ctx = elements.categoryChart.getContext('2d');
        
        if (categoryChartInstance) {
            categoryChartInstance.destroy();
        }
        
        categoryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
        
    } catch (error) {
        console.error('Error loading category chart:', error);
        createSampleCategoryChart();
    }
}

// Create sample category chart (fallback)
function createSampleCategoryChart() {
    const ctx = elements.categoryChart.getContext('2d');
    const labels = ['Drakor', 'Dracin', 'Donghua', 'Lainnya'];
    const data = [15, 12, 8, 10];
    const backgroundColors = ['#667eea', '#764ba2', '#f093fb', '#4CAF50'];
    
    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

// Load recent activity
async function loadRecentActivity() {
    try {
        elements.activityList.innerHTML = `
            <div class="loading-activity">
                <div class="loading-spinner"></div>
                <p>Memuat aktivitas...</p>
            </div>
        `;
        
        // Get recent movies (upload activity)
        const { data: recentMovies, error: moviesError } = await supabase
            .from('movies')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
            
        // Get recent likes
        const { data: recentLikes, error: likesError } = await supabase
            .from('likes')
            .select('*, movies(title)')
            .order('created_at', { ascending: false })
            .limit(5);
            
        if (moviesError || likesError) throw moviesError || likesError;
        
        // Combine and sort activities
        const activities = [];
        
        // Add movie uploads
        recentMovies?.forEach(movie => {
            activities.push({
                type: 'upload',
                text: `Film "${movie.title}" diupload`,
                time: movie.created_at,
                icon: 'upload'
            });
        });
        
        // Add likes
        recentLikes?.forEach(like => {
            activities.push({
                type: 'like',
                text: `User menyukai "${like.movies?.title || 'film'}"`,
                time: like.created_at,
                icon: 'like'
            });
        });
        
        // Sort by time and take top 10
        activities.sort((a, b) => new Date(b.time) - new Date(a.time));
        const recentActivities = activities.slice(0, 10);
        
        // Display activities
        if (recentActivities.length === 0) {
            elements.activityList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📊</div>
                    <p>Belum ada aktivitas</p>
                </div>
            `;
            return;
        }
        
        elements.activityList.innerHTML = recentActivities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.icon}">
                    ${getActivityIcon(activity.icon)}
                </div>
                <div class="activity-content">
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${formatTime(activity.time)}</div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading recent activity:', error);
        elements.activityList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <p>Gagal memuat aktivitas</p>
            </div>
        `;
    }
}

// Load top movies
async function loadTopMovies() {
    try {
        elements.topMoviesList.innerHTML = `
            <div class="loading-movies">
                <div class="loading-spinner"></div>
                <p>Memuat film...</p>
            </div>
        `;
        
        const { data: topMovies, error } = await supabase
            .from('movies')
            .select('*')
            .order('views', { ascending: false })
            .limit(5);
            
        if (error) throw error;
        
        if (!topMovies || topMovies.length === 0) {
            elements.topMoviesList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎬</div>
                    <p>Belum ada film</p>
                </div>
            `;
            return;
        }
        
        elements.topMoviesList.innerHTML = topMovies.map((movie, index) => `
            <div class="top-movie-item" onclick="viewMovie('${movie.id}')">
                <div class="movie-rank rank-${index + 1}">${index + 1}</div>
                <img src="${movie.thumbnail_url || 'https://placehold.co/50x70?text=No+Image'}" 
                     alt="${movie.title}"
                     class="movie-thumbnail"
                     onerror="this.src='https://placehold.co/50x70?text=No+Image'">
                <div class="movie-info">
                    <div class="movie-title">${movie.title}</div>
                    <div class="movie-stats">
                        <span>👁️ ${movie.views || 0}</span>
                        <span>👍 ${movie.likes || 0}</span>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading top movies:', error);
        elements.topMoviesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <p>Gagal memuat film</p>
            </div>
        `;
    }
}

// ===============================
// UPLOAD FUNCTIONS
// ===============================

// Handle thumbnail URL input
function handleThumbnailUrlInput() {
    const url = elements.thumbnailUrl.value.trim();
    
    if (url) {
        currentThumbnailFile = null;
        elements.uploadPlaceholder.classList.remove('hidden');
        elements.uploadPreview.classList.add('hidden');
        elements.thumbnailPreview.src = '';
        
        if (isValidImageUrl(url)) {
            elements.thumbnailUrl.style.borderColor = '#28a745';
        } else {
            elements.thumbnailUrl.style.borderColor = '#dc3545';
        }
    } else {
        elements.thumbnailUrl.style.borderColor = '#ddd';
    }
}

// Validasi URL gambar
function isValidImageUrl(url) {
    const imageRegex = /\.(jpeg|jpg|png|webp|gif|bmp)(\?.*)?$/i;
    return imageRegex.test(url) || url.includes('images.unsplash.com') || url.includes('placehold.co');
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!validateForm()) {
        return;
    }
    
    await uploadMovie();
}

// Validasi form
function validateForm() {
    const title = elements.movieTitle.value.trim();
    const videoUrl = elements.videoUrl.value.trim();
    const category = elements.movieCategory.value;
    const thumbnailUrl = elements.thumbnailUrl.value.trim();
    
    if (!title) {
        showError('Judul film harus diisi');
        return false;
    }
    
    if (!category) {
        showError('Kategori harus dipilih');
        return false;
    }
    
    if (!videoUrl) {
        showError('URL video harus diisi');
        return false;
    }
    
    if (thumbnailUrl && !isValidImageUrl(thumbnailUrl)) {
        showError('URL gambar thumbnail tidak valid');
        return false;
    }
    
    if (!isValidVideoUrl(videoUrl)) {
        showError('URL video tidak valid. Gunakan YouTube, Google Drive, atau URL video langsung.');
        return false;
    }
    
    return true;
}

// Validasi URL video
function isValidVideoUrl(url) {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)/;
    const googleDriveRegex = /^(https?:\/\/)?(drive\.google\.com\/)/;
    const urlRegex = /^https?:\/\/.+\..+/;
    
    return youtubeRegex.test(url) || googleDriveRegex.test(url) || urlRegex.test(url);
}

// Validasi URL video real-time
function validateVideoUrl() {
    const url = elements.videoUrl.value.trim();
    
    if (url && !isValidVideoUrl(url)) {
        elements.videoUrl.style.borderColor = '#dc3545';
    } else {
        elements.videoUrl.style.borderColor = '#ddd';
    }
}

// Generate thumbnail URL dari video URL
function generateThumbnailUrl(videoUrl, movieTitle = "") {
    if (!videoUrl) return 'https://placehold.co/400x225?text=No+Thumbnail';
    
    // YouTube thumbnail
    if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
        let videoId;
        if (videoUrl.includes("youtube.com/watch?v=")) {
            videoId = new URL(videoUrl).searchParams.get("v");
        } else if (videoUrl.includes("youtu.be/")) {
            videoId = videoUrl.split("youtu.be/")[1].split('?')[0];
        }
        
        if (videoId) {
            return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
    }
    
    // Google Drive thumbnail
    if (videoUrl.includes("drive.google.com")) {
        let fileId;
        if (videoUrl.includes("/file/d/")) {
            fileId = videoUrl.split('/file/d/')[1].split('/')[0];
        } else if (videoUrl.includes("id=")) {
            fileId = new URL(videoUrl).searchParams.get("id");
        }
        
        if (fileId) {
            return `https://lh3.googleusercontent.com/d/${fileId}=s220?authuser=0`;
        }
    }
    
    // Supabase Storage
    if (videoUrl.includes("supabase.co/storage/v1/object/public/videos/")) {
        const videoName = videoUrl.split('/').pop();
        return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(videoName.split('.')[0] || 'Video')}`;
    }
    
    // Default placeholder dengan judul film
    const shortTitle = movieTitle.length > 15 ? movieTitle.substring(0, 15) + '...' : movieTitle;
    return `https://placehold.co/400x225/667eea/ffffff?text=${encodeURIComponent(shortTitle || 'Video')}`;
}

// Handle thumbnail upload
function handleThumbnailUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    elements.thumbnailUrl.value = '';
    elements.thumbnailUrl.style.borderColor = '#ddd';
    
    processThumbnailFile(file);
}

// Process thumbnail file
function processThumbnailFile(file) {
    if (!file.type.startsWith('image/')) {
        showError('File harus berupa gambar');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showError('Ukuran file maksimal 5MB');
        return;
    }
    
    currentThumbnailFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        elements.thumbnailPreview.src = e.target.result;
        elements.uploadPlaceholder.classList.add('hidden');
        elements.uploadPreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// Handle edit thumbnail upload
function handleEditThumbnailUpload(movieId, event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const urlInput = document.getElementById(`edit-thumbnail-url-${movieId}`);
    if (urlInput) {
        urlInput.value = '';
    }
    
    processEditThumbnailFile(movieId, file);
}

// Process edit thumbnail file
function processEditThumbnailFile(movieId, file) {
    if (!file.type.startsWith('image/')) {
        showError('File harus berupa gambar');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showError('Ukuran file maksimal 5MB');
        return;
    }
    
    editThumbnailFiles[movieId] = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById(`edit-thumbnail-preview-${movieId}`);
        const placeholder = document.getElementById(`edit-upload-placeholder-${movieId}`);
        const previewContainer = document.getElementById(`edit-upload-preview-${movieId}`);
        
        if (preview && placeholder && previewContainer) {
            preview.src = e.target.result;
            placeholder.classList.add('hidden');
            previewContainer.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
}

// Handle edit thumbnail URL input
function handleEditThumbnailUrlInput(movieId) {
    const urlInput = document.getElementById(`edit-thumbnail-url-${movieId}`);
    if (!urlInput) return;
    
    const url = urlInput.value.trim();
    
    if (url) {
        delete editThumbnailFiles[movieId];
        const placeholder = document.getElementById(`edit-upload-placeholder-${movieId}`);
        const previewContainer = document.getElementById(`edit-upload-preview-${movieId}`);
        
        if (placeholder && previewContainer) {
            placeholder.classList.remove('hidden');
            previewContainer.classList.add('hidden');
        }
        
        if (isValidImageUrl(url)) {
            urlInput.style.borderColor = '#28a745';
        } else {
            urlInput.style.borderColor = '#dc3545';
        }
    } else {
        urlInput.style.borderColor = '#ddd';
    }
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    elements.thumbnailUploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    elements.thumbnailUploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    elements.thumbnailUploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        elements.thumbnailUrl.value = '';
        elements.thumbnailUrl.style.borderColor = '#ddd';
        
        processThumbnailFile(files[0]);
    }
}

// Edit drag and drop handlers
function handleEditDragOver(movieId, event) {
    event.preventDefault();
    const uploadArea = document.getElementById(`edit-upload-area-${movieId}`);
    if (uploadArea) {
        uploadArea.classList.add('dragover');
    }
}

function handleEditDragLeave(movieId, event) {
    event.preventDefault();
    const uploadArea = document.getElementById(`edit-upload-area-${movieId}`);
    if (uploadArea) {
        uploadArea.classList.remove('dragover');
    }
}

function handleEditDrop(movieId, event) {
    event.preventDefault();
    const uploadArea = document.getElementById(`edit-upload-area-${movieId}`);
    if (uploadArea) {
        uploadArea.classList.remove('dragover');
    }
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        const urlInput = document.getElementById(`edit-thumbnail-url-${movieId}`);
        if (urlInput) {
            urlInput.value = '';
        }
        
        processEditThumbnailFile(movieId, files[0]);
    }
}

// Upload movie ke database
async function uploadMovie() {
    showLoading();
    disableForm(true);
    
    try {
        let thumbnailUrl = '';
        
        if (currentThumbnailFile) {
            thumbnailUrl = await uploadThumbnail();
            if (!thumbnailUrl) {
                throw new Error('Gagal upload thumbnail');
            }
        } else if (elements.thumbnailUrl.value.trim()) {
            thumbnailUrl = elements.thumbnailUrl.value.trim();
        } else {
            const videoUrl = elements.videoUrl.value.trim();
            const movieTitle = elements.movieTitle.value.trim();
            thumbnailUrl = generateThumbnailUrl(videoUrl, movieTitle);
        }
        
        const movieData = {
            title: elements.movieTitle.value.trim(),
            description: elements.movieDesc.value.trim(),
            category: elements.movieCategory.value,
            video_url: elements.videoUrl.value.trim(),
            thumbnail_url: thumbnailUrl,
            duration: elements.movieDuration.value ? parseInt(elements.movieDuration.value) : null,
            views: 0,
            likes: 0
        };
        
        const { data: movie, error } = await supabase
            .from('movies')
            .insert([movieData])
            .select()
            .single();
            
        if (error) {
            throw error;
        }
        
        uploadedMovieId = movie.id;
        
        showSuccess('Film berhasil diupload!');
        
        resetForm();
        await loadMoviesList();
        
    } catch (error) {
        console.error('Error uploading movie:', error);
        showError('Gagal upload film: ' + error.message);
    } finally {
        hideLoading();
        disableForm(false);
    }
}

// Upload thumbnail ke storage
async function uploadThumbnail() {
    if (!currentThumbnailFile) return null;
    
    try {
        const fileExt = currentThumbnailFile.name.split('.').pop();
        const fileName = `thumbnails/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
            .from('thumbnails')
            .upload(fileName, currentThumbnailFile);
            
        if (error) {
            throw error;
        }
        
        const { data: { publicUrl } } = supabase.storage
            .from('thumbnails')
            .getPublicUrl(fileName);
            
        return publicUrl;
        
    } catch (error) {
        console.error('Error uploading thumbnail:', error);
        throw new Error('Gagal upload thumbnail: ' + error.message);
    }
}

// Upload edit thumbnail ke storage
async function uploadEditThumbnail(movieId) {
    const file = editThumbnailFiles[movieId];
    if (!file) return null;
    
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `thumbnails/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { data, error } = await supabase.storage
            .from('thumbnails')
            .upload(fileName, file);
            
        if (error) {
            throw error;
        }
        
        const { data: { publicUrl } } = supabase.storage
            .from('thumbnails')
            .getPublicUrl(fileName);
            
        return publicUrl;
        
    } catch (error) {
        console.error('Error uploading edit thumbnail:', error);
        throw new Error('Gagal upload thumbnail: ' + error.message);
    }
}

// Load daftar film
async function loadMoviesList() {
    try {
        const { data: movies, error } = await supabase
            .from('movies')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) {
            throw error;
        }
        
        allMovies = movies || [];
        displayMoviesList(allMovies);
        
    } catch (error) {
        console.error('Error loading movies:', error);
        elements.moviesList.innerHTML = '<div class="no-movies">Gagal memuat daftar film</div>';
    }
}

// Filter movies berdasarkan kategori
function filterMovies() {
    const selectedCategory = elements.categoryFilter.value;
    
    if (!selectedCategory) {
        displayMoviesList(allMovies);
        return;
    }
    
    const filteredMovies = allMovies.filter(movie => movie.category === selectedCategory);
    displayMoviesList(filteredMovies);
}

// Display movies list
function displayMoviesList(movies) {
    if (!movies || movies.length === 0) {
        elements.moviesList.innerHTML = '<div class="no-movies">Belum ada film yang diupload</div>';
        return;
    }
    
    elements.moviesList.innerHTML = movies.map(movie => {
        const categoryDisplay = movie.category ? 
            movie.category.charAt(0).toUpperCase() + movie.category.slice(1) : 
            'Lainnya';
            
        const categoryClass = movie.category ? `category-${movie.category}` : 'category-lainnya';
        
        if (editingMovieId === movie.id) {
            return `
                <div class="movie-item">
                    <div class="movie-info">
                        <div class="movie-title">Edit Film: ${movie.title}</div>
                        <form class="movie-edit-form" onsubmit="handleEditSubmit(event, '${movie.id}')">
                            <div class="form-group">
                                <label>Judul Film *</label>
                                <input type="text" name="title" value="${movie.title || ''}" required>
                            </div>
                            <div class="form-group">
                                <label>Deskripsi</label>
                                <textarea name="description">${movie.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Kategori *</label>
                                <select name="category" required>
                                    <option value="drakor" ${movie.category === 'drakor' ? 'selected' : ''}>Drakor</option>
                                    <option value="dracin" ${movie.category === 'dracin' ? 'selected' : ''}>Dracin</option>
                                    <option value="donghua" ${movie.category === 'donghua' ? 'selected' : ''}>Donghua</option>
                                    <option value="anime" ${movie.category === 'anime' ? 'selected' : ''}>Anime</option>
                                    <option value="film" ${movie.category === 'film' ? 'selected' : ''}>Film</option>
                                    <option value="series" ${movie.category === 'series' ? 'selected' : ''}>Series</option>
                                    <option value="lainnya" ${movie.category === 'lainnya' ? 'selected' : ''}>Lainnya</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>URL Video *</label>
                                <input type="url" name="video_url" value="${movie.video_url || ''}" required>
                            </div>
                            <div class="form-group">
                                <label>Durasi (menit)</label>
                                <input type="number" name="duration" value="${movie.duration || ''}" min="1">
                            </div>
                            
                            <div class="edit-thumbnail-section">
                                <label>Thumbnail</label>
                                <div class="edit-thumbnail-container">
                                    <div class="current-thumbnail">
                                        <img src="${movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title)}" 
                                             alt="Current thumbnail"
                                             onerror="this.src='https://placehold.co/120x90?text=No+Thumb'">
                                        <small>Thumbnail Saat Ini</small>
                                    </div>
                                    <div class="edit-thumbnail-upload">
                                        <div class="edit-upload-area" id="edit-upload-area-${movie.id}">
                                            <input 
                                                type="file" 
                                                id="edit-thumbnail-upload-${movie.id}" 
                                                accept="image/*" 
                                                hidden
                                                onchange="handleEditThumbnailUpload('${movie.id}', event)"
                                            >
                                            <div class="edit-upload-placeholder" id="edit-upload-placeholder-${movie.id}">
                                                <div class="upload-icon">📷</div>
                                                <p>Klik untuk upload thumbnail baru</p>
                                                <small>Format: JPG, PNG, WebP (Maks. 5MB)</small>
                                            </div>
                                            <div class="edit-upload-preview hidden" id="edit-upload-preview-${movie.id}">
                                                <img id="edit-thumbnail-preview-${movie.id}" src="" alt="Preview thumbnail baru">
                                                <button type="button" class="edit-change-btn" onclick="document.getElementById('edit-thumbnail-upload-${movie.id}').click()">Ganti</button>
                                            </div>
                                        </div>
                                        
                                        <div class="form-group" style="margin-top: 12px;">
                                            <label>Atau Masukkan URL Gambar Baru</label>
                                            <input 
                                                type="url" 
                                                id="edit-thumbnail-url-${movie.id}" 
                                                name="thumbnail_url" 
                                                placeholder="https://example.com/image.jpg"
                                                oninput="handleEditThumbnailUrlInput('${movie.id}')"
                                            >
                                            <small class="help-text">Kosongkan jika tidak ingin mengubah thumbnail</small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="edit-form-actions">
                                <button type="button" class="action-btn cancel" onclick="cancelEdit()">Batal</button>
                                <button type="submit" class="action-btn save">Simpan Perubahan</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        }
        
        return `
        <div class="movie-item">
            <img src="${movie.thumbnail_url || generateThumbnailUrl(movie.video_url, movie.title)}" 
                 alt="${movie.title}" 
                 class="movie-thumbnail"
                 onerror="this.src='https://placehold.co/80x60?text=No+Thumb'">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-meta">
                    <span class="category-badge ${categoryClass}">
                        ${categoryDisplay}
                    </span>
                    <span class="movie-views">👁️ ${movie.views || 0} views</span>
                    • ${movie.duration ? `${movie.duration} menit` : 'Durasi tidak diketahui'}
                    • ${new Date(movie.created_at).toLocaleDateString('id-ID')}
                </div>
            </div>
            <div class="movie-actions">
                <button class="action-btn view" onclick="viewMovie('${movie.id}')">Lihat</button>
                <button class="action-btn edit" onclick="startEdit('${movie.id}')">Edit</button>
                <button class="action-btn delete" onclick="deleteMovie('${movie.id}')">Hapus</button>
            </div>
        </div>
        `;
    }).join('');
    
    setupEditFormListeners();
}

// Setup event listeners untuk form edit
function setupEditFormListeners() {
    allMovies.forEach(movie => {
        if (editingMovieId === movie.id) {
            const uploadArea = document.getElementById(`edit-upload-area-${movie.id}`);
            if (uploadArea) {
                uploadArea.addEventListener('dragover', (e) => handleEditDragOver(movie.id, e));
                uploadArea.addEventListener('dragleave', (e) => handleEditDragLeave(movie.id, e));
                uploadArea.addEventListener('drop', (e) => handleEditDrop(movie.id, e));
                uploadArea.addEventListener('click', () => document.getElementById(`edit-thumbnail-upload-${movie.id}`).click());
            }
        }
    });
}

// View movie
function viewMovie(movieId) {
    window.open(`detail.html?id=${movieId}`, '_blank');
}

// Start edit mode
function startEdit(movieId) {
    editingMovieId = movieId;
    delete editThumbnailFiles[movieId];
    loadMoviesList();
}

// Cancel edit mode
function cancelEdit() {
    editingMovieId = null;
    loadMoviesList();
}

// Handle edit form submission
async function handleEditSubmit(event, movieId) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    
    const updateData = {
        title: formData.get('title').trim(),
        description: formData.get('description').trim(),
        category: formData.get('category'),
        video_url: formData.get('video_url').trim(),
        duration: formData.get('duration') ? parseInt(formData.get('duration')) : null,
        updated_at: new Date().toISOString()
    };
    
    if (!isValidVideoUrl(updateData.video_url)) {
        showError('URL video tidak valid. Gunakan YouTube, Google Drive, atau URL video langsung.');
        return;
    }
    
    const thumbnailUrlInput = document.getElementById(`edit-thumbnail-url-${movieId}`);
    if (thumbnailUrlInput && thumbnailUrlInput.value.trim()) {
        if (!isValidImageUrl(thumbnailUrlInput.value.trim())) {
            showError('URL gambar thumbnail tidak valid');
            return;
        }
        updateData.thumbnail_url = thumbnailUrlInput.value.trim();
    } else if (editThumbnailFiles[movieId]) {
        const thumbnailUrl = await uploadEditThumbnail(movieId);
        if (thumbnailUrl) {
            updateData.thumbnail_url = thumbnailUrl;
        }
    } else {
        const movie = allMovies.find(m => m.id === movieId);
        if (movie) {
            updateData.thumbnail_url = generateThumbnailUrl(updateData.video_url, updateData.title);
        }
    }
    
    await updateMovie(movieId, updateData);
}

// Update movie di database
async function updateMovie(movieId, updateData) {
    showLoading();
    
    try {
        const { error } = await supabase
            .from('movies')
            .update(updateData)
            .eq('id', movieId);
            
        if (error) {
            throw error;
        }
        
        editingMovieId = null;
        delete editThumbnailFiles[movieId];
        await loadMoviesList();
        showSuccess('Film berhasil diupdate!');
        
    } catch (error) {
        console.error('Error updating movie:', error);
        showError('Gagal update film: ' + error.message);
    } finally {
        hideLoading();
    }
}

// Delete movie
async function deleteMovie(movieId) {
    if (!confirm('Hapus film ini?')) return;
    
    try {
        const { error } = await supabase
            .from('movies')
            .delete()
            .eq('id', movieId);
            
        if (error) {
            throw error;
        }
        
        await loadMoviesList();
        showSuccess('Film berhasil dihapus');
        
    } catch (error) {
        console.error('Error deleting movie:', error);
        showError('Gagal menghapus film: ' + error.message);
    }
}

// View uploaded movie
function viewUploadedMovie() {
    if (uploadedMovieId) {
        viewMovie(uploadedMovieId);
    }
    hidePopup('success');
}

// Reset form
function resetForm() {
    elements.uploadForm.reset();
    currentThumbnailFile = null;
    elements.uploadPlaceholder.classList.remove('hidden');
    elements.uploadPreview.classList.add('hidden');
    elements.thumbnailPreview.src = '';
    elements.thumbnailUrl.style.borderColor = '#ddd';
}

// Disable/enable form
function disableForm(disabled) {
    const inputs = elements.uploadForm.querySelectorAll('input, textarea, button, select');
    inputs.forEach(input => {
        if (input !== elements.resetBtn && input !== elements.submitBtn) {
            input.disabled = disabled;
        }
    });
    
    if (disabled) {
        elements.submitText.textContent = 'Mengupload...';
        elements.submitSpinner.classList.remove('hidden');
        elements.submitBtn.disabled = true;
    } else {
        elements.submitText.textContent = 'Upload Film';
        elements.submitSpinner.classList.add('hidden');
        elements.submitBtn.disabled = false;
    }
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

// Tab Navigation Functions
function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionName).classList.add('active');
    
    // Update active tab
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Set active tab based on section
    if (sectionName === 'dashboard') {
        document.querySelector('.tab-btn').classList.add('active');
    } else if (sectionName === 'upload') {
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
    
    // Load data if needed
    if (sectionName === 'dashboard') {
        loadDashboardData();
    } else if (sectionName === 'upload') {
        loadMoviesList();
    }
}

// Logout function
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error logging out:', error);
        showError('Gagal logout');
    }
}

// Manage users (placeholder)
function manageUsers() {
    showError('Fitur kelola user akan segera hadir');
}

function getActivityIcon(type) {
    const icons = {
        upload: '📤',
        view: '👁️',
        like: '👍',
        user: '👤'
    };
    return icons[type] || '📊';
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays === 1) return 'Kemarin';
    if (diffDays < 7) return `${diffDays} hari lalu`;
    
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short'
    });
}

function showLoading() {
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

function showSuccess(message) {
    elements.successMessage.textContent = message;
    showPopup('success');
}

function showError(message) {
    elements.errorMessage.textContent = message;
    showPopup('error');
}

// Export functions ke global scope
window.showSection = showSection;
window.logout = logout;
window.manageUsers = manageUsers;
window.redirectToHome = redirectToHome;
window.handleEditSubmit = handleEditSubmit;
window.viewMovie = viewMovie;
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.deleteMovie = deleteMovie;
window.handleEditThumbnailUpload = handleEditThumbnailUpload;
window.handleEditThumbnailUrlInput = handleEditThumbnailUrlInput;
window.handleEditDragOver = handleEditDragOver;
window.handleEditDragLeave = handleEditDragLeave;
window.handleEditDrop = handleEditDrop;
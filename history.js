import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const elements = {
    // Containers
    historyContainer: document.getElementById('history-container'),
    emptyState: document.getElementById('empty-state'),
    loadMoreContainer: document.getElementById('load-more-container'),
    
    // Stats
    totalWatched: document.getElementById('total-watched'),
    totalHours: document.getElementById('total-hours'),
    activeDays: document.getElementById('active-days'),
    
    // Buttons
    sortBtn: document.getElementById('sort-btn'),
    clearAllBtn: document.getElementById('clear-all-btn'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    gridViewBtn: document.getElementById('grid-view'),
    listViewBtn: document.getElementById('list-view'),
    confirmClear: document.getElementById('confirm-clear'),
    cancelClear: document.getElementById('cancel-clear'),
    
    // Options
    sortOptions: document.getElementById('sort-options'),
    
    // Modal
    clearModal: document.getElementById('clear-modal')
};

// State
let currentUser = null;
let allHistory = [];
let displayedHistory = [];
let currentSort = 'recent';
let currentView = 'grid';
let currentPage = 1;
const ITEMS_PER_PAGE = 12;

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Fungsi inisialisasi
async function initializeApp() {
    // Cek session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        // Redirect ke login jika belum login
        window.location.href = 'loginuser.html';
        return;
    }

    currentUser = session.user;
    await loadHistory();
}

// Setup event listeners
function setupEventListeners() {
    // View toggle
    elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    elements.listViewBtn.addEventListener('click', () => switchView('list'));
    
    // Sort
    elements.sortBtn.addEventListener('click', toggleSortOptions);
    
    // Sort options
    document.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const sortType = e.target.dataset.sort;
            applySort(sortType);
        });
    });
    
    // Clear history
    elements.clearAllBtn.addEventListener('click', showClearModal);
    elements.confirmClear.addEventListener('click', clearAllHistory);
    elements.cancelClear.addEventListener('click', hideClearModal);
    
    // Load more
    elements.loadMoreBtn.addEventListener('click', loadMore);
    
    // Modal backdrop
    elements.clearModal.addEventListener('click', (e) => {
        if (e.target === elements.clearModal) hideClearModal();
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideClearModal();
            elements.sortOptions.classList.add('hidden');
        }
    });
}

// Load history dari database
async function loadHistory() {
    try {
        showLoading();
        
        const { data: history, error } = await supabase
            .from('watch_history')
            .select(`
                id,
                watched_at,
                created_at,
                movie_id,
                movies (
                    id,
                    title,
                    description,
                    thumbnail_url,
                    video_url,
                    duration,
                    views,
                    likes,
                    category,
                    created_at
                )
            `)
            .eq('user_id', currentUser.id)
            .order('watched_at', { ascending: false });

        if (error) {
            throw error;
        }

        allHistory = history || [];
        updateStats();
        applySort(currentSort);
        
    } catch (error) {
        console.error('Error loading history:', error);
        showError('Gagal memuat riwayat tonton');
    } finally {
        hideLoading();
    }
}

// Update statistics
function updateStats() {
    elements.totalWatched.textContent = allHistory.length;
    
    // Hitung total jam menonton
    const totalMinutes = allHistory.reduce((total, item) => {
        return total + (item.movies?.duration || 0);
    }, 0);
    
    const totalHours = Math.round(totalMinutes / 60);
    elements.totalHours.textContent = totalHours;
    
    // Hitung hari aktif (unique days)
    const uniqueDays = new Set();
    allHistory.forEach(item => {
        const date = new Date(item.watched_at).toDateString();
        uniqueDays.add(date);
    });
    
    elements.activeDays.textContent = uniqueDays.size;
}

// Apply sorting
function applySort(sortType) {
    currentSort = sortType;
    
    // Update UI
    document.querySelectorAll('.sort-option').forEach(option => {
        option.classList.toggle('active', option.dataset.sort === sortType);
    });
    
    elements.sortOptions.classList.add('hidden');
    
    // Sort history
    let sortedHistory = [...allHistory];
    
    switch (sortType) {
        case 'recent':
            sortedHistory.sort((a, b) => new Date(b.watched_at) - new Date(a.watched_at));
            break;
        case 'oldest':
            sortedHistory.sort((a, b) => new Date(a.watched_at) - new Date(b.watched_at));
            break;
        case 'title':
            sortedHistory.sort((a, b) => (a.movies?.title || '').localeCompare(b.movies?.title || ''));
            break;
        case 'views':
            sortedHistory.sort((a, b) => (b.movies?.views || 0) - (a.movies?.views || 0));
            break;
    }
    
    displayedHistory = sortedHistory;
    currentPage = 1;
    displayHistory();
}

// Switch view mode
function switchView(view) {
    currentView = view;
    
    elements.gridViewBtn.classList.toggle('active', view === 'grid');
    elements.listViewBtn.classList.toggle('active', view === 'list');
    elements.historyContainer.classList.toggle('grid-view', view === 'grid');
    elements.historyContainer.classList.toggle('list-view', view === 'list');
    
    displayHistory();
}

// Display history
function displayHistory() {
    if (displayedHistory.length === 0) {
        elements.historyContainer.classList.add('hidden');
        elements.emptyState.classList.remove('hidden');
        elements.loadMoreContainer.classList.add('hidden');
        return;
    }
    
    elements.historyContainer.classList.remove('hidden');
    elements.emptyState.classList.add('hidden');
    
    const startIndex = 0;
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const historyToShow = displayedHistory.slice(startIndex, endIndex);
    
    elements.historyContainer.innerHTML = historyToShow.map(item => `
        <div class="history-card" data-id="${item.movie_id}">
            <img src="${item.movies?.thumbnail_url || 'https://placehold.co/300x450?text=No+Image'}" 
                 alt="${item.movies?.title || 'Unknown'}"
                 class="history-thumbnail"
                 onerror="this.src='https://placehold.co/300x450?text=No+Image'">
            
            <div class="history-actions">
                <button class="action-btn remove-btn" onclick="removeFromHistory('${item.id}')">×</button>
            </div>
            
            <div class="history-info">
                <h3 class="history-title">${item.movies?.title || 'Unknown'}</h3>
                <div class="history-meta">
                    ${item.movies?.category ? `<span class="category-badge">${item.movies.category}</span>` : ''}
                    <span class="watch-time">${formatTime(item.watched_at)}</span>
                    ${item.movies?.duration ? `<span class="movie-duration">⏱️ ${item.movies.duration}m</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click event to history cards
    elements.historyContainer.querySelectorAll('.history-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Jangan trigger jika klik tombol action
            if (!e.target.closest('.history-actions')) {
                const movieId = card.dataset.id;
                window.location.href = `detail.html?id=${movieId}`;
            }
        });
    });
    
    // Show/hide load more button
    if (displayedHistory.length > endIndex) {
        elements.loadMoreContainer.classList.remove('hidden');
    } else {
        elements.loadMoreContainer.classList.add('hidden');
    }
}

// Load more history
function loadMore() {
    currentPage++;
    displayHistory();
}

// Toggle sort options
function toggleSortOptions() {
    elements.sortOptions.classList.toggle('hidden');
}

// Show clear confirmation modal
function showClearModal() {
    if (allHistory.length === 0) {
        showError('Tidak ada riwayat untuk dihapus');
        return;
    }
    elements.clearModal.classList.remove('hidden');
}

// Hide clear modal
function hideClearModal() {
    elements.clearModal.classList.add('hidden');
}

// Clear all history
async function clearAllHistory() {
    try {
        const { error } = await supabase
            .from('watch_history')
            .delete()
            .eq('user_id', currentUser.id);
            
        if (error) {
            throw error;
        }
        
        // Clear local state
        allHistory = [];
        displayedHistory = [];
        
        updateStats();
        displayHistory();
        hideClearModal();
        
        showSuccess('Semua riwayat berhasil dihapus');
        
    } catch (error) {
        console.error('Error clearing history:', error);
        showError('Gagal menghapus riwayat');
    }
}

// Remove single item from history
async function removeFromHistory(historyId) {
    try {
        const { error } = await supabase
            .from('watch_history')
            .delete()
            .eq('id', historyId);
            
        if (error) {
            throw error;
        }
        
        // Remove from local state
        allHistory = allHistory.filter(item => item.id !== historyId);
        displayedHistory = displayedHistory.filter(item => item.id !== historyId);
        
        updateStats();
        displayHistory();
        
        showSuccess('Riwayat dihapus');
        
    } catch (error) {
        console.error('Error removing history item:', error);
        showError('Gagal menghapus riwayat');
    }
}

// Format waktu tonton
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
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} minggu lalu`;
    
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Utility functions
function showLoading() {
    elements.historyContainer.innerHTML = `
        <div class="loading-history">
            <div class="loading-spinner"></div>
            <p>Memuat riwayat tonton...</p>
        </div>
    `;
}

function hideLoading() {
    // Loading state akan diganti oleh displayHistory
}

function showSuccess(message) {
    alert(`✅ ${message}`);
}

function showError(message) {
    alert(`❌ ${message}`);
}

// Export functions untuk digunakan di HTML
window.removeFromHistory = removeFromHistory;
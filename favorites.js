import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const elements = {
    // Containers
    favoritesContainer: document.getElementById('favorites-container'),
    emptyState: document.getElementById('empty-state'),
    loadMoreContainer: document.getElementById('load-more-container'),
    
    // Stats
    totalFavorites: document.getElementById('total-favorites'),
    totalCategories: document.getElementById('total-categories'),
    
    // Buttons
    sortBtn: document.getElementById('sort-btn'),
    filterBtn: document.getElementById('filter-btn'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    gridViewBtn: document.getElementById('grid-view'),
    listViewBtn: document.getElementById('list-view'),
    applyFilter: document.getElementById('apply-filter'),
    resetFilter: document.getElementById('reset-filter'),
    
    // Options
    sortOptions: document.getElementById('sort-options'),
    filterOptions: document.getElementById('filter-options'),
    
    // Modal
    actionModal: document.getElementById('action-modal'),
    closeModal: document.getElementById('close-modal'),
    modalMovieTitle: document.getElementById('modal-movie-title')
};

// State
let currentUser = null;
let allFavorites = [];
let displayedFavorites = [];
let currentSort = 'recent';
let currentFilters = {
    categories: ['all']
};
let currentView = 'grid';
let currentPage = 1;
const ITEMS_PER_PAGE = 12;
let selectedMovieId = null;

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
    await loadFavorites();
}

// Setup event listeners
function setupEventListeners() {
    // View toggle
    elements.gridViewBtn.addEventListener('click', () => switchView('grid'));
    elements.listViewBtn.addEventListener('click', () => switchView('list'));
    
    // Sort & Filter
    elements.sortBtn.addEventListener('click', toggleSortOptions);
    elements.filterBtn.addEventListener('click', toggleFilterOptions);
    
    // Sort options
    document.querySelectorAll('.sort-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const sortType = e.target.dataset.sort;
            applySort(sortType);
        });
    });
    
    // Filter options
    elements.applyFilter.addEventListener('click', applyFilters);
    elements.resetFilter.addEventListener('click', resetFilters);
    
    // Load more
    elements.loadMoreBtn.addEventListener('click', loadMore);
    
    // Modal
    elements.closeModal.addEventListener('click', closeModal);
    elements.actionModal.addEventListener('click', (e) => {
        if (e.target === elements.actionModal) closeModal();
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            elements.sortOptions.classList.add('hidden');
            elements.filterOptions.classList.add('hidden');
        }
    });
}

// Load favorites dari database
async function loadFavorites() {
    try {
        showLoading();
        
        const { data: favorites, error } = await supabase
            .from('favorites')
            .select(`
                id,
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
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        allFavorites = favorites || [];
        updateStats();
        applySort(currentSort);
        
    } catch (error) {
        console.error('Error loading favorites:', error);
        showError('Gagal memuat film favorit');
    } finally {
        hideLoading();
    }
}

// Update statistics
function updateStats() {
    elements.totalFavorites.textContent = allFavorites.length;
    
    // Hitung jumlah kategori unik
    const categories = new Set();
    allFavorites.forEach(fav => {
        if (fav.movies?.category) {
            categories.add(fav.movies.category);
        }
    });
    
    elements.totalCategories.textContent = categories.size;
}

// Apply sorting
function applySort(sortType) {
    currentSort = sortType;
    
    // Update UI
    document.querySelectorAll('.sort-option').forEach(option => {
        option.classList.toggle('active', option.dataset.sort === sortType);
    });
    
    elements.sortOptions.classList.add('hidden');
    
    // Sort favorites
    let sortedFavorites = [...allFavorites];
    
    switch (sortType) {
        case 'recent':
            sortedFavorites.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'oldest':
            sortedFavorites.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'title':
            sortedFavorites.sort((a, b) => (a.movies?.title || '').localeCompare(b.movies?.title || ''));
            break;
        case 'views':
            sortedFavorites.sort((a, b) => (b.movies?.views || 0) - (a.movies?.views || 0));
            break;
    }
    
    displayedFavorites = sortedFavorites;
    currentPage = 1;
    displayFavorites();
}

// Apply filters
function applyFilters() {
    const selectedCategories = [];
    document.querySelectorAll('.category-filters input:checked').forEach(checkbox => {
        if (checkbox.value !== 'all') {
            selectedCategories.push(checkbox.value);
        }
    });
    
    currentFilters.categories = selectedCategories.length > 0 ? selectedCategories : ['all'];
    elements.filterOptions.classList.add('hidden');
    
    // Filter favorites
    let filteredFavorites = [...allFavorites];
    
    if (!currentFilters.categories.includes('all')) {
        filteredFavorites = filteredFavorites.filter(fav => 
            currentFilters.categories.includes(fav.movies?.category)
        );
    }
    
    displayedFavorites = filteredFavorites;
    currentPage = 1;
    displayFavorites();
}

// Reset filters
function resetFilters() {
    document.querySelectorAll('.category-filters input').forEach(checkbox => {
        checkbox.checked = checkbox.value === 'all';
    });
    
    currentFilters.categories = ['all'];
    elements.filterOptions.classList.add('hidden');
    
    displayedFavorites = [...allFavorites];
    currentPage = 1;
    displayFavorites();
}

// Switch view mode
function switchView(view) {
    currentView = view;
    
    elements.gridViewBtn.classList.toggle('active', view === 'grid');
    elements.listViewBtn.classList.toggle('active', view === 'list');
    elements.favoritesContainer.classList.toggle('grid-view', view === 'grid');
    elements.favoritesContainer.classList.toggle('list-view', view === 'list');
    
    displayFavorites();
}

// Display favorites
function displayFavorites() {
    if (displayedFavorites.length === 0) {
        elements.favoritesContainer.classList.add('hidden');
        elements.emptyState.classList.remove('hidden');
        elements.loadMoreContainer.classList.add('hidden');
        return;
    }
    
    elements.favoritesContainer.classList.remove('hidden');
    elements.emptyState.classList.add('hidden');
    
    const startIndex = 0;
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const favoritesToShow = displayedFavorites.slice(startIndex, endIndex);
    
    elements.favoritesContainer.innerHTML = favoritesToShow.map(fav => `
        <div class="movie-card" data-id="${fav.movie_id}">
            <img src="${fav.movies?.thumbnail_url || 'https://placehold.co/300x450?text=No+Image'}" 
                 alt="${fav.movies?.title || 'Unknown'}"
                 class="movie-thumbnail"
                 onerror="this.src='https://placehold.co/300x450?text=No+Image'">
            
            <div class="movie-actions">
                <button class="action-btn more-btn" onclick="openActionModal('${fav.movie_id}', '${fav.movies?.title || 'Unknown'}')">⋯</button>
            </div>
            
            <div class="movie-info">
                <h3 class="movie-title">${fav.movies?.title || 'Unknown'}</h3>
                <div class="movie-meta">
                    ${fav.movies?.category ? `<span class="category-badge">${fav.movies.category}</span>` : ''}
                    <span class="movie-views">👁️ ${fav.movies?.views || 0}</span>
                    ${fav.movies?.duration ? `<span class="movie-duration">⏱️ ${fav.movies.duration}m</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    // Add click event to movie cards
    elements.favoritesContainer.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Jangan trigger jika klik tombol action
            if (!e.target.closest('.movie-actions')) {
                const movieId = card.dataset.id;
                window.location.href = `detail.html?id=${movieId}`;
            }
        });
    });
    
    // Show/hide load more button
    if (displayedFavorites.length > endIndex) {
        elements.loadMoreContainer.classList.remove('hidden');
    } else {
        elements.loadMoreContainer.classList.add('hidden');
    }
}

// Load more favorites
function loadMore() {
    currentPage++;
    displayFavorites();
}

// Toggle sort options
function toggleSortOptions() {
    elements.sortOptions.classList.toggle('hidden');
    elements.filterOptions.classList.add('hidden');
}

// Toggle filter options
function toggleFilterOptions() {
    elements.filterOptions.classList.toggle('hidden');
    elements.sortOptions.classList.add('hidden');
}

// Open action modal
function openActionModal(movieId, movieTitle) {
    selectedMovieId = movieId;
    elements.modalMovieTitle.textContent = movieTitle;
    elements.actionModal.classList.remove('hidden');
}

// Close modal
function closeModal() {
    elements.actionModal.classList.add('hidden');
    selectedMovieId = null;
}

// Watch movie
function watchMovie() {
    if (selectedMovieId) {
        window.location.href = `detail.html?id=${selectedMovieId}`;
    }
}

// Remove from favorites
async function removeFromFavorites() {
    if (!selectedMovieId) return;
    
    try {
        const { error } = await supabase
            .from('favorites')
            .delete()
            .eq('movie_id', selectedMovieId)
            .eq('user_id', currentUser.id);
            
        if (error) {
            throw error;
        }
        
        // Remove from local state
        allFavorites = allFavorites.filter(fav => fav.movie_id !== selectedMovieId);
        displayedFavorites = displayedFavorites.filter(fav => fav.movie_id !== selectedMovieId);
        
        updateStats();
        displayFavorites();
        closeModal();
        
        showSuccess('Film dihapus dari favorit');
        
    } catch (error) {
        console.error('Error removing favorite:', error);
        showError('Gagal menghapus dari favorit');
    }
}

// Share movie
function shareMovie() {
    if (selectedMovieId) {
        const shareUrl = `${window.location.origin}/detail.html?id=${selectedMovieId}`;
        
        if (navigator.share) {
            navigator.share({
                title: elements.modalMovieTitle.textContent,
                url: shareUrl
            });
        } else {
            navigator.clipboard.writeText(shareUrl);
            showSuccess('Link film disalin ke clipboard!');
        }
    }
    closeModal();
}

// Utility functions
function showLoading() {
    elements.favoritesContainer.innerHTML = `
        <div class="loading-favorites">
            <div class="loading-spinner"></div>
            <p>Memuat film favorit...</p>
        </div>
    `;
}

function hideLoading() {
    // Loading state akan diganti oleh displayFavorites
}

function showSuccess(message) {
    alert(`✅ ${message}`);
}

function showError(message) {
    alert(`❌ ${message}`);
}

// Export functions untuk digunakan di HTML
window.openActionModal = openActionModal;
window.watchMovie = watchMovie;
window.removeFromFavorites = removeFromFavorites;
window.shareMovie = shareMovie;
window.closeModal = closeModal;
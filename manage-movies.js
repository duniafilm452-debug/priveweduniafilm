import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen DOM
const elements = {
    // Search and Filter
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    categoryFilter: document.getElementById('category-filter'),
    sortFilter: document.getElementById('sort-filter'),
    
    // Bulk Actions
    bulkActionsBtn: document.getElementById('bulk-actions-btn'),
    bulkActionsPanel: document.getElementById('bulk-actions-panel'),
    selectAll: document.getElementById('select-all'),
    selectedCount: document.getElementById('selected-count'),
    bulkDelete: document.getElementById('bulk-delete'),
    clearSelection: document.getElementById('clear-selection'),
    
    // Table
    moviesTableBody: document.getElementById('movies-table-body'),
    emptyState: document.getElementById('empty-state'),
    
    // Pagination
    showingStart: document.getElementById('showing-start'),
    showingEnd: document.getElementById('showing-end'),
    totalMovies: document.getElementById('total-movies'),
    prevPage: document.getElementById('prev-page'),
    nextPage: document.getElementById('next-page'),
    pageNumbers: document.getElementById('page-numbers'),
    
    // Modals
    deleteModal: document.getElementById('delete-modal'),
    editModal: document.getElementById('edit-modal'),
    confirmDelete: document.getElementById('confirm-delete'),
    cancelDelete: document.getElementById('cancel-delete'),
    closeEditModal: document.getElementById('close-edit-modal'),
    cancelEdit: document.getElementById('cancel-edit'),
    
    // Edit Form
    editForm: document.getElementById('edit-form'),
    editMovieId: document.getElementById('edit-movie-id'),
    editTitle: document.getElementById('edit-title'),
    editCategory: document.getElementById('edit-category'),
    editDescription: document.getElementById('edit-description'),
    editVideoUrl: document.getElementById('edit-video-url'),
    editDuration: document.getElementById('edit-duration'),
    editThumbnailUrl: document.getElementById('edit-thumbnail-url'),
    saveEdit: document.getElementById('save-edit'),
    saveText: document.getElementById('save-text'),
    saveSpinner: document.getElementById('save-spinner'),
    
    // Loading
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
};

// State
let currentUser = null;
let allMovies = [];
let filteredMovies = [];
let selectedMovies = new Set();
let currentPage = 1;
const ITEMS_PER_PAGE = 10;
let currentFilters = {
    search: '',
    category: '',
    sort: 'newest'
};
let movieToDelete = null;

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Fungsi inisialisasi
async function initializeApp() {
    // Cek session admin
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    // CEK APAKAH USER ADALAH ADMIN
    const isUserAdmin = await checkIfUserIsAdmin(session.user.id);
    
    if (!isUserAdmin) {
        window.location.href = 'admin.html';
        return;
    }

    currentUser = session.user;
    await loadMovies();
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

// Setup event listeners
function setupEventListeners() {
    // Search and Filter
    elements.searchBtn.addEventListener('click', handleSearch);
    elements.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    elements.categoryFilter.addEventListener('change', handleFilter);
    elements.sortFilter.addEventListener('change', handleSort);
    
    // Bulk Actions
    elements.bulkActionsBtn.addEventListener('click', toggleBulkActions);
    elements.selectAll.addEventListener('change', handleSelectAll);
    elements.bulkDelete.addEventListener('click', handleBulkDelete);
    elements.clearSelection.addEventListener('click', clearAllSelection);
    
    // Pagination
    elements.prevPage.addEventListener('click', goToPrevPage);
    elements.nextPage.addEventListener('click', goToNextPage);
    
    // Modals
    elements.confirmDelete.addEventListener('click', confirmDeleteMovie);
    elements.cancelDelete.addEventListener('click', hideDeleteModal);
    elements.closeEditModal.addEventListener('click', hideEditModal);
    elements.cancelEdit.addEventListener('click', hideEditModal);
    elements.editForm.addEventListener('submit', handleEditSubmit);
    
    // Modal backdrops
    elements.deleteModal.addEventListener('click', (e) => {
        if (e.target === elements.deleteModal) hideDeleteModal();
    });
    elements.editModal.addEventListener('click', (e) => {
        if (e.target === elements.editModal) hideEditModal();
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideDeleteModal();
            hideEditModal();
            elements.bulkActionsPanel.classList.add('hidden');
        }
    });
}

// Load movies dari database
async function loadMovies() {
    try {
        showTableLoading();
        
        const { data: movies, error } = await supabase
            .from('movies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        allMovies = movies || [];
        applyFilters();
        
    } catch (error) {
        console.error('Error loading movies:', error);
        showError('Gagal memuat data film');
    }
}

// Apply filters and sorting
function applyFilters() {
    filteredMovies = [...allMovies];
    
    // Apply search filter
    if (currentFilters.search) {
        const searchTerm = currentFilters.search.toLowerCase();
        filteredMovies = filteredMovies.filter(movie => 
            movie.title.toLowerCase().includes(searchTerm) ||
            (movie.description && movie.description.toLowerCase().includes(searchTerm))
        );
    }
    
    // Apply category filter
    if (currentFilters.category) {
        filteredMovies = filteredMovies.filter(movie => 
            movie.category && movie.category.toLowerCase() === currentFilters.category.toLowerCase()
        );
    }
    
    // Apply sorting
    switch (currentFilters.sort) {
        case 'oldest':
            filteredMovies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            break;
        case 'views-desc':
            filteredMovies.sort((a, b) => (b.views || 0) - (a.views || 0));
            break;
        case 'views-asc':
            filteredMovies.sort((a, b) => (a.views || 0) - (b.views || 0));
            break;
        case 'title-asc':
            filteredMovies.sort((a, b) => a.title.localeCompare(b.title));
            break;
        case 'title-desc':
            filteredMovies.sort((a, b) => b.title.localeCompare(a.title));
            break;
        case 'newest':
        default:
            filteredMovies.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
    }
    
    currentPage = 1;
    displayMovies();
    updatePagination();
}

// Display movies in table
function displayMovies() {
    if (filteredMovies.length === 0) {
        elements.moviesTableBody.innerHTML = '';
        elements.emptyState.classList.remove('hidden');
        return;
    }
    
    elements.emptyState.classList.add('hidden');
    
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const moviesToShow = filteredMovies.slice(startIndex, endIndex);
    
    elements.moviesTableBody.innerHTML = moviesToShow.map(movie => `
        <tr data-movie-id="${movie.id}">
            <td class="checkbox-cell">
                <input type="checkbox" class="movie-checkbox" value="${movie.id}">
            </td>
            <td class="thumbnail-cell">
                <img src="${movie.thumbnail_url || 'https://placehold.co/60x40?text=No+Image'}" 
                     alt="${movie.title}"
                     class="movie-thumbnail"
                     onerror="this.src='https://placehold.co/60x40?text=No+Image'">
            </td>
            <td class="title-cell">${movie.title}</td>
            <td class="category-cell">
                <span class="category-badge">${movie.category || 'Lainnya'}</span>
            </td>
            <td class="views-cell">${movie.views || 0}</td>
            <td class="likes-cell">${movie.likes || 0}</td>
            <td class="duration-cell">${movie.duration ? `${movie.duration}m` : '-'}</td>
            <td class="date-cell">${formatDate(movie.created_at)}</td>
            <td class="actions-cell">
                <div class="action-buttons">
                    <button class="action-btn view-btn" onclick="viewMovie('${movie.id}')" title="Lihat">👁️</button>
                    <button class="action-btn edit-btn" onclick="editMovie('${movie.id}')" title="Edit">✏️</button>
                    <button class="action-btn delete-btn-sm" onclick="showDeleteModal('${movie.id}', '${movie.title.replace(/'/g, "\\'")}')" title="Hapus">🗑️</button>
                </div>
            </td>
        </tr>
    `).join('');
    
    // Add event listeners to checkboxes
    elements.moviesTableBody.querySelectorAll('.movie-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', handleMovieSelection);
    });
    
    updateSelectionUI();
}

// Update pagination
function updatePagination() {
    const totalPages = Math.ceil(filteredMovies.length / ITEMS_PER_PAGE);
    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, filteredMovies.length);
    
    elements.showingStart.textContent = startItem;
    elements.showingEnd.textContent = endItem;
    elements.totalMovies.textContent = filteredMovies.length;
    
    // Previous/Next buttons
    elements.prevPage.disabled = currentPage === 1;
    elements.nextPage.disabled = currentPage === totalPages || totalPages === 0;
    
    // Page numbers
    elements.pageNumbers.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    const maxPages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPages / 2));
    let endPage = Math.min(totalPages, startPage + maxPages - 1);
    
    if (endPage - startPage + 1 < maxPages) {
        startPage = Math.max(1, endPage - maxPages + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => goToPage(i));
        elements.pageNumbers.appendChild(pageBtn);
    }
}

// Event handlers
function handleSearch() {
    currentFilters.search = elements.searchInput.value.trim();
    applyFilters();
}

function handleFilter() {
    currentFilters.category = elements.categoryFilter.value;
    applyFilters();
}

function handleSort() {
    currentFilters.sort = elements.sortFilter.value;
    applyFilters();
}

function toggleBulkActions() {
    elements.bulkActionsPanel.classList.toggle('hidden');
}

function handleSelectAll() {
    const checkboxes = elements.moviesTableBody.querySelectorAll('.movie-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = elements.selectAll.checked;
        handleMovieSelection({ target: checkbox });
    });
}

function handleMovieSelection(e) {
    const movieId = e.target.value;
    
    if (e.target.checked) {
        selectedMovies.add(movieId);
    } else {
        selectedMovies.delete(movieId);
    }
    
    updateSelectionUI();
}

function updateSelectionUI() {
    const checkboxes = elements.moviesTableBody.querySelectorAll('.movie-checkbox');
    const checkedCount = elements.moviesTableBody.querySelectorAll('.movie-checkbox:checked').length;
    
    elements.selectAll.checked = checkedCount > 0 && checkedCount === checkboxes.length;
    elements.selectedCount.textContent = `${selectedMovies.size} film dipilih`;
    
    if (selectedMovies.size > 0) {
        elements.bulkActionsPanel.classList.remove('hidden');
    } else {
        elements.bulkActionsPanel.classList.add('hidden');
    }
}

function clearAllSelection() {
    selectedMovies.clear();
    elements.selectAll.checked = false;
    elements.moviesTableBody.querySelectorAll('.movie-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectionUI();
}

// Pagination
function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        displayMovies();
        updatePagination();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(filteredMovies.length / ITEMS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        displayMovies();
        updatePagination();
    }
}

function goToPage(page) {
    currentPage = page;
    displayMovies();
    updatePagination();
}

// Movie Actions
function viewMovie(movieId) {
    window.open(`detail.html?id=${movieId}`, '_blank');
}

function editMovie(movieId) {
    const movie = allMovies.find(m => m.id === movieId);
    if (!movie) return;
    
    // Fill form with movie data
    elements.editMovieId.value = movie.id;
    elements.editTitle.value = movie.title;
    elements.editCategory.value = movie.category || '';
    elements.editDescription.value = movie.description || '';
    elements.editVideoUrl.value = movie.video_url;
    elements.editDuration.value = movie.duration || '';
    elements.editThumbnailUrl.value = movie.thumbnail_url || '';
    
    showEditModal();
}

function showDeleteModal(movieId, movieTitle) {
    movieToDelete = movieId;
    document.getElementById('delete-title').textContent = 'Hapus Film';
    document.getElementById('delete-message').textContent = `Apakah Anda yakin ingin menghapus film "${movieTitle}"? Tindakan ini tidak dapat dibatalkan.`;
    elements.deleteModal.classList.remove('hidden');
}

function hideDeleteModal() {
    elements.deleteModal.classList.add('hidden');
    movieToDelete = null;
}

function showEditModal() {
    elements.editModal.classList.remove('hidden');
}

function hideEditModal() {
    elements.editModal.classList.add('hidden');
    elements.editForm.reset();
}

// Handle bulk delete
function handleBulkDelete() {
    if (selectedMovies.size === 0) return;
    
    movieToDelete = Array.from(selectedMovies);
    document.getElementById('delete-title').textContent = 'Hapus Film Massal';
    document.getElementById('delete-message').textContent = `Apakah Anda yakin ingin menghapus ${selectedMovies.size} film? Tindakan ini tidak dapat dibatalkan.`;
    elements.deleteModal.classList.remove('hidden');
}

// Confirm delete
async function confirmDeleteMovie() {
    try {
        showLoading('Menghapus film...');
        
        let result;
        
        if (Array.isArray(movieToDelete)) {
            // Bulk delete
            const { error } = await supabase
                .from('movies')
                .delete()
                .in('id', movieToDelete);
                
            if (error) throw error;
            result = `${movieToDelete.length} film berhasil dihapus`;
        } else {
            // Single delete
            const { error } = await supabase
                .from('movies')
                .delete()
                .eq('id', movieToDelete);
                
            if (error) throw error;
            result = 'Film berhasil dihapus';
        }
        
        hideDeleteModal();
        await loadMovies(); // Reload data
        showSuccess(result);
        
    } catch (error) {
        console.error('Error deleting movie:', error);
        showError('Gagal menghapus film');
    } finally {
        hideLoading();
    }
}

// Handle edit submit
async function handleEditSubmit(e) {
    e.preventDefault();
    
    const movieData = {
        title: elements.editTitle.value.trim(),
        category: elements.editCategory.value,
        description: elements.editDescription.value.trim(),
        video_url: elements.editVideoUrl.value.trim(),
        duration: elements.editDuration.value ? parseInt(elements.editDuration.value) : null,
        updated_at: new Date().toISOString()
    };
    
    // Only update thumbnail if provided
    if (elements.editThumbnailUrl.value.trim()) {
        movieData.thumbnail_url = elements.editThumbnailUrl.value.trim();
    }
    
    try {
        disableEditForm(true);
        
        const { error } = await supabase
            .from('movies')
            .update(movieData)
            .eq('id', elements.editMovieId.value);
            
        if (error) throw error;
        
        hideEditModal();
        await loadMovies(); // Reload data
        showSuccess('Film berhasil diperbarui');
        
    } catch (error) {
        console.error('Error updating movie:', error);
        showError('Gagal memperbarui film');
    } finally {
        disableEditForm(false);
    }
}

// Utility functions
function showTableLoading() {
    elements.moviesTableBody.innerHTML = `
        <tr>
            <td colspan="9" class="loading-cell">
                <div class="loading-movies">
                    <div class="loading-spinner"></div>
                    <p>Memuat data film...</p>
                </div>
            </td>
        </tr>
    `;
}

function showLoading(message = 'Memproses...') {
    elements.loadingText.textContent = message;
    elements.loadingOverlay.classList.remove('hidden');
}

function hideLoading() {
    elements.loadingOverlay.classList.add('hidden');
}

function disableEditForm(disabled) {
    const inputs = elements.editForm.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => {
        if (input !== elements.cancelEdit) {
            input.disabled = disabled;
        }
    });
    
    if (disabled) {
        elements.saveText.textContent = 'Menyimpan...';
        elements.saveSpinner.classList.remove('hidden');
        elements.saveEdit.disabled = true;
    } else {
        elements.saveText.textContent = 'Simpan Perubahan';
        elements.saveSpinner.classList.add('hidden');
        elements.saveEdit.disabled = false;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function showSuccess(message) {
    alert(`✅ ${message}`);
}

function showError(message) {
    alert(`❌ ${message}`);
}

// Export functions untuk digunakan di HTML
window.viewMovie = viewMovie;
window.editMovie = editMovie;
window.showDeleteModal = showDeleteModal;
window.goBackToAdmin = function() {
    window.location.href = 'admin.html';
};
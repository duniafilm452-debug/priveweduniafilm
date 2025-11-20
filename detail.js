import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Elemen HTML
const videoPlayer = document.getElementById("video-player");
const titleBelowEl = document.getElementById("movie-title-below");
const descEl = document.getElementById("movie-desc");
const viewCount = document.getElementById("view-count");
const likeBtn = document.getElementById("like-btn");
const favBtn = document.getElementById("fav-btn");
const shareBtn = document.getElementById("share-btn");
const likeCount = document.getElementById("like-count");
const recommendList = document.getElementById("recommend-list");
const toggleDescBtn = document.getElementById("toggle-desc-btn");

// Elemen baru untuk episode
const episodesTab = document.getElementById("episodes-tab");
const recommendationsTab = document.getElementById("recommendations-tab");
const episodesContent = document.getElementById("episodes-content");
const recommendationsContent = document.getElementById("recommendations-content");
const episodesList = document.getElementById("episodes-list");

// Popup
const popup = document.getElementById("login-popup");
const popupCancel = document.getElementById("popup-cancel");
const popupLogin = document.getElementById("popup-login");

// Data aplikasi
const params = new URLSearchParams(window.location.search);
const movieId = params.get("id"); // Kembali menggunakan ID
let currentUser = null;
let currentMovie = null;
let hasIncrementedViews = false;

// Inisialisasi aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    await initializeApp();
    setupEventListeners();
});

// Fungsi inisialisasi
async function initializeApp() {
    showLoading(true);
    
    try {
        // Cek session user
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
        }

        await loadMovie();
        
    } catch (error) {
        console.error('Error in initializeApp:', error);
        showError('Gagal memuat aplikasi');
    } finally {
        showLoading(false);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    if (popupCancel) popupCancel.onclick = () => popup.classList.add("hidden");
    if (popupLogin) popupLogin.onclick = () => window.location.href = "loginuser.html";
    
    const backBtn = document.getElementById("back-btn");
    if (backBtn) backBtn.onclick = () => window.location.href = "index.html";
    
    // Actions
    if (likeBtn) likeBtn.onclick = handleLike;
    if (favBtn) favBtn.onclick = handleFavorite;
    if (shareBtn) shareBtn.onclick = handleShare;
    
    // Tab navigation
    if (episodesTab) episodesTab.onclick = () => switchTab('episodes');
    if (recommendationsTab) recommendationsTab.onclick = () => switchTab('recommendations');
    
    // Video events
    if (videoPlayer) {
        videoPlayer.addEventListener('load', handleVideoLoad);
        videoPlayer.addEventListener('play', handleVideoPlay);
        videoPlayer.addEventListener('error', handleVideoError);
    }

    // Toggle description
    if (toggleDescBtn) {
        toggleDescBtn.onclick = toggleDescription;
    }

    // Auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
            currentUser = session.user;
            await checkLikeStatus();
            await checkFavoriteStatus();
            if (popup) popup.classList.add("hidden");
            showSuccessPopup('Login berhasil!');
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            await checkLikeStatus();
            await checkFavoriteStatus();
        }
    });
}

// ===============================
// FUNGSI UTAMA
// ===============================

// Load movie data by ID
async function loadMovie() {
    if (!movieId) {
        showError('ID film tidak ditemukan');
        return;
    }

    try {
        const { data, error } = await supabase
            .from("movies")
            .select("*")
            .eq("id", movieId)
            .single();

        if (error) {
            console.error('Error loading movie:', error);
            showError('Gagal memuat data film');
            return;
        }

        if (!data) {
            showError('Film tidak ditemukan');
            return;
        }

        currentMovie = data;
        await displayMovieData();

        await Promise.all([
            checkLikeStatus(),
            checkFavoriteStatus()
        ]);

        // Cek apakah film ini bagian dari series
        const seriesTitle = extractSeriesTitle(currentMovie.title);
        if (seriesTitle) {
            // Jika ada series, default tab ke episodes
            setTimeout(() => switchTab('episodes'), 100);
        } else {
            // Jika bukan series, default tab ke recommendations
            setTimeout(() => switchTab('recommendations'), 100);
        }

    } catch (error) {
        console.error('Exception in loadMovie:', error);
        showError('Terjadi kesalahan saat memuat film');
    }
}

// Display movie data
async function displayMovieData() {
    if (titleBelowEl) titleBelowEl.textContent = currentMovie.title;
    
    // Set description dengan toggle functionality
    if (descEl) {
        descEl.textContent = currentMovie.description || "Tidak ada deskripsi.";
        checkDescriptionLength();
    }

    // Update view count display
    if (viewCount) {
        viewCount.textContent = `👁️ ${currentMovie.views || 0} tayangan`;
    }

    // Process video URL
    let videoUrl = currentMovie.video_url;
    videoUrl = await processVideoUrl(videoUrl);
    
    console.log('Final Video URL:', videoUrl);
    
    // Set video source berdasarkan jenis URL
    if (videoUrl.includes('youtube.com/embed') || 
        videoUrl.includes('drive.google.com') ||
        videoUrl.includes('gofile.io')) {
        
        // Gunakan iframe untuk YouTube, Google Drive, dan GoFile
        if (videoPlayer) {
            videoPlayer.src = videoUrl;
            videoPlayer.style.display = 'block';
        }
    } else {
        // Gunakan HTML5 video player untuk Wasabi dan lainnya
        replaceIframeWithVideoPlayer(videoUrl);
    }
}

// Replace iframe dengan HTML5 video player untuk Wasabi
function replaceIframeWithVideoPlayer(videoUrl) {
    if (!videoPlayer) return;
    
    const videoContainer = videoPlayer.parentElement;
    const newVideoPlayer = document.createElement('video');
    
    newVideoPlayer.id = 'video-player';
    newVideoPlayer.controls = true;
    newVideoPlayer.style.width = '100%';
    newVideoPlayer.style.height = '100%';
    newVideoPlayer.style.position = 'absolute';
    newVideoPlayer.style.top = '0';
    newVideoPlayer.style.left = '0';
    newVideoPlayer.style.borderRadius = '12px';
    
    // Add source element
    const source = document.createElement('source');
    source.src = videoUrl;
    source.type = getVideoMimeType(videoUrl);
    
    newVideoPlayer.appendChild(source);
    newVideoPlayer.innerHTML += 'Browser Anda tidak mendukung pemutar video.';
    
    // Replace iframe dengan video element
    videoPlayer.replaceWith(newVideoPlayer);
    
    // Update event listeners untuk video element baru
    newVideoPlayer.addEventListener('load', handleVideoLoad);
    newVideoPlayer.addEventListener('play', handleVideoPlay);
    newVideoPlayer.addEventListener('error', handleVideoError);
    newVideoPlayer.addEventListener('loadeddata', handleVideoLoad);
}

// Get MIME type berdasarkan ekstensi file
function getVideoMimeType(videoUrl) {
    if (videoUrl.includes('.mp4')) return 'video/mp4';
    if (videoUrl.includes('.webm')) return 'video/webm';
    if (videoUrl.includes('.ogg')) return 'video/ogg';
    if (videoUrl.includes('.mov')) return 'video/quicktime';
    return 'video/mp4'; // default
}

// Check description length and show/hide toggle button
function checkDescriptionLength() {
    if (!descEl || !toggleDescBtn) return;
    
    // Reset untuk mengukur ulang
    descEl.classList.remove('description-collapsed');
    toggleDescBtn.classList.add('hidden');
    
    // Gunakan setTimeout untuk memastikan DOM sudah dirender
    setTimeout(() => {
        const lineHeight = parseInt(getComputedStyle(descEl).lineHeight);
        const maxHeight = lineHeight * 2; // Maksimal 2 baris
        
        if (descEl.scrollHeight > maxHeight) {
            descEl.classList.add('description-collapsed');
            toggleDescBtn.classList.remove('hidden');
            toggleDescBtn.textContent = 'Selengkapnya';
        }
    }, 100);
}

// Toggle description visibility
function toggleDescription() {
    if (!descEl || !toggleDescBtn) return;
    
    if (descEl.classList.contains('description-collapsed')) {
        // Tampilkan semua deskripsi
        descEl.classList.remove('description-collapsed');
        toggleDescBtn.textContent = 'Sembunyikan';
    } else {
        // Sembunyikan deskripsi (hanya 2 baris)
        descEl.classList.add('description-collapsed');
        toggleDescBtn.textContent = 'Selengkapnya';
    }
}

// Switch tab function
function switchTab(tabName) {
    // Update tab buttons
    if (episodesTab && recommendationsTab) {
        episodesTab.classList.toggle('active', tabName === 'episodes');
        recommendationsTab.classList.toggle('active', tabName === 'recommendations');
    }
    
    // Update tab content
    if (episodesContent && recommendationsContent) {
        episodesContent.classList.toggle('active', tabName === 'episodes');
        recommendationsContent.classList.toggle('active', tabName === 'recommendations');
    }
    
    // Load content jika diperlukan
    if (tabName === 'episodes') {
        loadEpisodes();
    } else if (tabName === 'recommendations') {
        loadRecommendations();
    }
}

// Handle video load
function handleVideoLoad() {
    console.log('Video loaded, checking for view increment...');
    // Increment views when video is loaded and ready to play
    if (!hasIncrementedViews) {
        updateViewCount();
    }
}

// Handle video play
function handleVideoPlay() {
    console.log('Video started playing...');
    // Increment views when video starts playing (fallback)
    if (!hasIncrementedViews) {
        updateViewCount();
    }
}

// Process video URL untuk berbagai sumber - DIPERBARUI untuk GoFile
async function processVideoUrl(videoUrl) {
    if (!videoUrl) return '';
    
    console.log('Processing video URL:', videoUrl);
    
    // YouTube URLs
    if (videoUrl.includes("youtube.com/watch?v=")) {
        const id = new URL(videoUrl).searchParams.get("v");
        return `https://www.youtube.com/embed/${id}?autoplay=0`;
    } else if (videoUrl.includes("youtu.be/")) {
        const id = videoUrl.split("youtu.be/")[1];
        return `https://www.youtube.com/embed/${id}?autoplay=0`;
    } 
    // Google Drive URLs
    else if (videoUrl.includes("drive.google.com")) {
        if (videoUrl.includes("/file/d/")) {
            const fileId = videoUrl.split('/file/d/')[1].split('/')[0];
            return `https://drive.google.com/file/d/${fileId}/preview`;
        } else if (videoUrl.includes("id=")) {
            const fileId = new URL(videoUrl).searchParams.get("id");
            return `https://drive.google.com/file/d/${fileId}/preview`;
        }
    } 
    // Wasabi URLs
    else if (videoUrl.includes("wasabisys.com") || videoUrl.includes("s3.wasabisys.com")) {
        // Wasabi URL langsung, return as-is untuk HTML5 video player
        console.log('Wasabi video URL detected:', videoUrl);
        return videoUrl;
    }
    // GoFile URLs - DITAMBAHKAN
    else if (videoUrl.includes("gofile.io")) {
        console.log('GoFile URL detected:', videoUrl);
        return await processGoFileUrl(videoUrl);
    }
    // Supabase Storage URLs
    else if (!videoUrl.startsWith("http")) {
        const { data: urlData } = supabase.storage.from("videos").getPublicUrl(videoUrl);
        return urlData.publicUrl;
    }
    
    return videoUrl;
}

// Process GoFile URL untuk mendapatkan link streaming langsung
async function processGoFileUrl(gofileUrl) {
    try {
        console.log('Processing GoFile URL:', gofileUrl);
        
        // Extract content ID dari URL GoFile
        let contentId;
        if (gofileUrl.includes('/d/')) {
            contentId = gofileUrl.split('/d/')[1];
        } else if (gofileUrl.includes('gofile.io/')) {
            const parts = gofileUrl.split('/');
            contentId = parts[parts.length - 1];
        }
        
        if (!contentId) {
            console.error('Cannot extract content ID from GoFile URL');
            return gofileUrl; // Fallback ke URL asli
        }
        
        // Dapatkan informasi file dari API GoFile
        const apiResponse = await fetch(`https://api.gofile.io/getContent?contentId=${contentId}&token=`);
        const apiData = await apiResponse.json();
        
        if (apiData.status === 'ok' && apiData.data) {
            // Cari file video pertama
            const findVideoFile = (content) => {
                if (content.type === 'file' && isVideoFile(content.name)) {
                    return content;
                }
                if (content.contents) {
                    for (const key in content.contents) {
                        const result = findVideoFile(content.contents[key]);
                        if (result) return result;
                    }
                }
                return null;
            };
            
            const videoFile = findVideoFile(apiData.data);
            if (videoFile && videoFile.link) {
                console.log('Found GoFile video link:', videoFile.link);
                return videoFile.link; // Link streaming langsung
            }
        }
        
        console.log('Using original GoFile URL as fallback');
        return gofileUrl;
        
    } catch (error) {
        console.error('Error processing GoFile URL:', error);
        return gofileUrl; // Fallback ke URL asli jika error
    }
}

// Helper function untuk mengecek apakah file adalah video
function isVideoFile(filename) {
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.3gp'];
    return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// Update view count - FIXED VERSION
async function updateViewCount() {
    if (!currentMovie || hasIncrementedViews) return;
    
    const movieId = currentMovie.id;
    
    try {
        // Cek session storage untuk mencegah multiple increments
        const viewKey = `viewed_${movieId}`;
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (hasViewed) {
            console.log('Already viewed in this session');
            return;
        }

        console.log('Incrementing view count for movie:', movieId);
        
        // Method 1: Try RPC function first
        const { data: rpcData, error: rpcError } = await supabase.rpc('increment_views', {
            movie_id: movieId
        });
        
        if (rpcError) {
            console.log('RPC failed, trying direct update:', rpcError);
            
            // Method 2: Direct update sebagai fallback
            const { data: movieData } = await supabase
                .from("movies")
                .select("views")
                .eq("id", movieId)
                .single();
                
            if (movieData) {
                const newViews = (movieData.views || 0) + 1;
                const { error: updateError } = await supabase
                    .from("movies")
                    .update({ views: newViews })
                    .eq("id", movieId);
                    
                if (updateError) {
                    console.error('Direct update also failed:', updateError);
                    throw updateError;
                }
                
                console.log('Direct update successful, new views:', newViews);
                
                // Update display
                if (viewCount) {
                    viewCount.textContent = `👁️ ${newViews} tayangan`;
                }
            }
        } else {
            console.log('RPC increment successful');
            
            // Refresh view count display
            const { data: updatedMovie } = await supabase
                .from("movies")
                .select("views")
                .eq("id", movieId)
                .single();
                
            if (updatedMovie && viewCount) {
                viewCount.textContent = `👁️ ${updatedMovie.views || 0} tayangan`;
            }
        }
        
        // Tandai sudah di-increment dalam session ini
        sessionStorage.setItem(viewKey, 'true');
        hasIncrementedViews = true;
        
        // Record watch history jika user login
        await recordWatchHistory();
        
    } catch (error) {
        console.error('Exception in updateViewCount:', error);
        // Tetap tampilkan error tapi jangan ganggu user experience
    }
}

// Record watch history
async function recordWatchHistory() {
    if (!currentUser || !currentMovie) return;
    
    try {
        await supabase
            .from("watch_history")
            .upsert({
                user_id: currentUser.id,
                movie_id: currentMovie.id,
                watched_at: new Date().toISOString()
            });
    } catch (error) {
        console.error('Exception in recordWatchHistory:', error);
    }
}

// Handle like
async function handleLike() {
    if (!currentUser || !currentMovie) {
        showLoginPopup("menyukai film");
        return;
    }
    
    try {
        const { data: existingLike } = await supabase
            .from("likes")
            .select("id")
            .eq("movie_id", currentMovie.id)
            .eq("user_id", currentUser.id)
            .single();
            
        if (existingLike) {
            await supabase.from("likes").delete().eq("id", existingLike.id);
            if (likeBtn) likeBtn.classList.remove("liked");
            showSuccessPopup('Like dihapus');
        } else {
            await supabase.from("likes").insert({
                movie_id: currentMovie.id,
                user_id: currentUser.id
            });
            if (likeBtn) likeBtn.classList.add("liked");
            showSuccessPopup('Film disukai!');
        }
        
        await updateLikeCount();
        
    } catch (error) {
        console.error('Exception in handleLike:', error);
        showError('Gagal memperbarui like');
    }
}

// Handle favorite
async function handleFavorite() {
    if (!currentUser || !currentMovie) {
        showLoginPopup("menambah favorit");
        return;
    }
    
    try {
        const { data: existingFav } = await supabase
            .from("favorites")
            .select("id")
            .eq("movie_id", currentMovie.id)
            .eq("user_id", currentUser.id)
            .single();
            
        if (existingFav) {
            await supabase.from("favorites").delete().eq("id", existingFav.id);
            if (favBtn) favBtn.classList.remove("favorited");
            showSuccessPopup('Dihapus dari favorit');
        } else {
            await supabase.from("favorites").insert({
                movie_id: currentMovie.id,
                user_id: currentUser.id
            });
            if (favBtn) favBtn.classList.add("favorited");
            showSuccessPopup('Ditambahkan ke favorit!');
        }
        
    } catch (error) {
        console.error('Exception in handleFavorite:', error);
        showError('Gagal memperbarui favorit');
    }
}

// Handle share - menggunakan ID seperti semula
function handleShare() {
    const shareUrl = window.location.href;
    const shareText = `Tonton "${currentMovie?.title || 'Film Menarik'}" di Dunia Film`;
    
    if (navigator.share) {
        navigator.share({
            title: currentMovie?.title || 'Dunia Film',
            text: shareText,
            url: shareUrl
        }).catch(err => {
            fallbackShare(shareUrl);
        });
    } else {
        fallbackShare(shareUrl);
    }
}

// Fallback share
function fallbackShare(url) {
    navigator.clipboard.writeText(url).then(() => {
        showSuccessPopup('Link berhasil disalin!');
    }).catch(err => {
        prompt('Salin link berikut:', url);
    });
}

// Check like status
async function checkLikeStatus() {
    if (!currentUser || !currentMovie) {
        if (likeBtn) likeBtn.classList.remove("liked");
        return;
    }
    
    try {
        const { data } = await supabase
            .from("likes")
            .select("id")
            .eq("movie_id", currentMovie.id)
            .eq("user_id", currentUser.id)
            .single();
            
        if (data) {
            if (likeBtn) likeBtn.classList.add("liked");
        } else {
            if (likeBtn) likeBtn.classList.remove("liked");
        }
        
        await updateLikeCount();
        
    } catch (error) {
        console.error('Exception in checkLikeStatus:', error);
    }
}

// Check favorite status
async function checkFavoriteStatus() {
    if (!currentUser || !currentMovie) {
        if (favBtn) favBtn.classList.remove("favorited");
        return;
    }
    
    try {
        const { data } = await supabase
            .from("favorites")
            .select("id")
            .eq("movie_id", currentMovie.id)
            .eq("user_id", currentUser.id)
            .single();
            
        if (data) {
            if (favBtn) favBtn.classList.add("favorited");
        } else {
            if (favBtn) favBtn.classList.remove("favorited");
        }
        
    } catch (error) {
        console.error('Exception in checkFavoriteStatus:', error);
    }
}

// Update like count
async function updateLikeCount() {
    if (!currentMovie) return;
    
    try {
        const { count } = await supabase
            .from("likes")
            .select("*", { count: "exact", head: true })
            .eq("movie_id", currentMovie.id);
            
        if (likeCount) likeCount.textContent = count || 0;
        
    } catch (error) {
        console.error('Exception in updateLikeCount:', error);
    }
}

// ===============================
// FUNGSI EPISODE
// ===============================

// Load episodes
async function loadEpisodes() {
    if (!currentMovie) return;
    
    try {
        if (episodesList) episodesList.innerHTML = '<div class="loading-episodes">Memuat episode...</div>';
        
        // Ekstrak judul series dari judul film
        const seriesTitle = extractSeriesTitle(currentMovie.title);
        
        if (!seriesTitle) {
            episodesList.innerHTML = '<div class="loading-episodes">Tidak ada episode lainnya.</div>';
            return;
        }
        
        // Cari semua episode dari series yang sama
        const { data: episodes, error } = await supabase
            .from("movies")
            .select("*")
            .ilike("title", `${seriesTitle}%`)
            .order("created_at", { ascending: true });
            
        if (error) throw error;
        
        renderEpisodes(episodes || []);
        
    } catch (error) {
        console.error('Exception in loadEpisodes:', error);
        if (episodesList) episodesList.innerHTML = '<div class="loading-episodes">Gagal memuat episode.</div>';
    }
}

// Extract series title dari judul film
function extractSeriesTitle(title) {
    if (!title) return null;
    
    // Pattern untuk mendeteksi episode (Episode 1, Part 2, Chapter 3, dll)
    const episodePatterns = [
        /(.*?)\s*[Ee]pisode\s*\d+/i,
        /(.*?)\s*[Pp]art\s*\d+/i,
        /(.*?)\s*[Cc]hapter\s*\d+/i,
        /(.*?)\s*-\s*[Ee]pisode\s*\d+/i,
        /(.*?)\s*\(\s*[Ee]pisode\s*\d+\s*\)/i,
        /(.*?)\s*\d+$/ // Pattern untuk judul yang diakhiri angka
    ];
    
    for (const pattern of episodePatterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    return null;
}

// Extract episode number
function extractEpisodeNumber(title) {
    if (!title) return null;
    
    const episodePatterns = [
        /[Ee]pisode\s*(\d+)/i,
        /[Pp]art\s*(\d+)/i,
        /[Cc]hapter\s*(\d+)/i,
        /-\s*(\d+)$/,
        /\(\s*(\d+)\s*\)$/,
        /(\d+)$/
    ];
    
    for (const pattern of episodePatterns) {
        const match = title.match(pattern);
        if (match && match[1]) {
            return parseInt(match[1]);
        }
    }
    
    return null;
}

// Render episodes - menggunakan struktur 9:16 dengan judul di bawah
function renderEpisodes(episodes) {
    if (!episodesList) return;
    
    if (!episodes || episodes.length === 0) {
        episodesList.innerHTML = '<div class="loading-episodes">Tidak ada episode lainnya.</div>';
        return;
    }
    
    episodesList.innerHTML = episodes.map(movie => {
        const episodeNumber = extractEpisodeNumber(movie.title);
        const isCurrentEpisode = movie.id === currentMovie.id;
        
        return `
            <div class="episode-item ${isCurrentEpisode ? 'current' : ''}" 
                 onclick="location.href='detail.html?id=${movie.id}'">
                <div class="episode-thumbnail-container">
                    <img src="${movie.thumbnail_url || 'https://via.placeholder.com/200x355?text=No+Thumbnail'}" 
                         alt="${movie.title}" 
                         onerror="this.src='https://via.placeholder.com/200x355?text=No+Thumbnail'"
                         loading="lazy">
                </div>
                <div class="episode-info">
                    <div class="episode-number">${episodeNumber ? `Episode ${episodeNumber}` : 'Episode'}</div>
                    <p class="episode-title">${escapeHtml(movie.title)}</p>
                    <div class="episode-meta">
                        <span class="views">👁️ ${movie.views || 0}</span>
                        <span class="episode-duration">${movie.duration || '--:--'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ===============================
// FUNGSI REKOMENDASI (VIDEO ACAK)
// ===============================

// Load recommendations - RANDOM VERSION
async function loadRecommendations() {
    if (!currentMovie) return;
    
    try {
        if (recommendList) recommendList.innerHTML = '<div class="loading-recommendations">Memuat rekomendasi...</div>';
        
        // Ambil 30-40 video secara acak yang bukan episode dari film yang sama
        const { data: randomMovies, error } = await supabase
            .from("movies")
            .select("*")
            .neq("id", currentMovie.id)
            .limit(40);
            
        if (error) throw error;
        
        // Filter untuk menghilangkan episode dari series yang sama
        const seriesTitle = extractSeriesTitle(currentMovie?.title);
        let filteredMovies = randomMovies || [];
        
        if (seriesTitle) {
            filteredMovies = filteredMovies.filter(movie => {
                const movieSeriesTitle = extractSeriesTitle(movie.title);
                return movieSeriesTitle !== seriesTitle;
            });
        }
        
        // Acak urutan video
        const shuffledMovies = shuffleArray(filteredMovies);
        
        // Ambil 20-30 video untuk ditampilkan
        const finalRecommendations = shuffledMovies.slice(0, 30);
        
        renderRecommendations(finalRecommendations);
        
    } catch (error) {
        console.error('Exception in loadRecommendations:', error);
        if (recommendList) recommendList.innerHTML = '<div class="loading-recommendations">Gagal memuat rekomendasi.</div>';
    }
}

// Fungsi untuk mengacak array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Render recommendations - menggunakan struktur 9:16 dengan judul di bawah
function renderRecommendations(movies) {
    if (!recommendList) return;
    
    if (!movies || movies.length === 0) {
        recommendList.innerHTML = '<div class="loading-recommendations">Tidak ada rekomendasi.</div>';
        return;
    }
    
    // Tampilkan video dengan grid yang responsive
    recommendList.innerHTML = movies.map(movie => `
        <div class="recommend-item" onclick="location.href='detail.html?id=${movie.id}'">
            <div class="recommend-thumbnail-container">
                <img src="${movie.thumbnail_url || 'https://via.placeholder.com/200x355?text=No+Thumbnail'}" 
                     alt="${movie.title}" 
                     onerror="this.src='https://via.placeholder.com/200x355?text=No+Thumbnail'"
                     loading="lazy">
            </div>
            <div class="recommend-info">
                <p class="recommend-title-text">${escapeHtml(movie.title)}</p>
                <div class="recommend-meta">
                    <span class="views">👁️ ${movie.views || 0}</span>
                    ${movie.genre ? `<span class="genre">${escapeHtml(movie.genre.split(',')[0])}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

// ===============================
// UTILITY FUNCTIONS
// ===============================

// Show login popup
function showLoginPopup(action = "melakukan aksi ini") {
    const popupText = document.querySelector(".login-popup p");
    if (popupText) popupText.textContent = `Untuk ${action}, silakan login terlebih dahulu.`;
    if (popup) popup.classList.remove("hidden");
}

// Loading state
function showLoading(show) {
    let loadingEl = document.getElementById('loading-overlay');
    if (!loadingEl && show) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'loading-overlay';
        loadingEl.className = 'loading-overlay';
        loadingEl.innerHTML = `
            <div class="loading-spinner"></div>
            <p>Memuat...</p>
        `;
        document.body.appendChild(loadingEl);
    } else if (loadingEl && !show) {
        loadingEl.remove();
    }
}

// Error handling
function showError(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-popup popup-overlay';
    errorEl.innerHTML = `
        <div class="popup-box error-popup">
            <div class="popup-icon">❌</div>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="popup-ok-btn" onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;
    document.body.appendChild(errorEl);
}

// Success popup
function showSuccessPopup(message) {
    const successEl = document.createElement('div');
    successEl.className = 'success-popup popup-overlay';
    successEl.innerHTML = `
        <div class="popup-box success-popup">
            <div class="popup-icon">✅</div>
            <h3>Sukses</h3>
            <p>${message}</p>
            <button class="popup-ok-btn" onclick="this.parentElement.parentElement.remove()">OK</button>
        </div>
    `;
    document.body.appendChild(successEl);
    
    setTimeout(() => {
        if (successEl.parentElement) {
            successEl.remove();
        }
    }, 3000);
}

// Handle video error
function handleVideoError() {
    const videoElement = document.getElementById('video-player');
    if (!videoElement) return;
    
    // Cek jika ini GoFile dan gagal load
    const currentSrc = videoElement.src;
    if (currentSrc.includes('gofile.io')) {
        showError(`
            Video dari GoFile tidak dapat diputar langsung. 
            Silakan klik link di bawah untuk menonton di website GoFile:
            <br><br>
            <a href="${currentSrc}" target="_blank" style="color: #ff0000; text-decoration: underline;">
                Buka di GoFile
            </a>
        `);
        return;
    }
    
    const errorMessage = `
        <div style="text-align: center; padding: 40px; color: #666; background: #1a1a1a; border-radius: 12px; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="font-size: 3rem; margin-bottom: 15px;">📹</div>
            <h3 style="margin-bottom: 10px; color: #fff;">Video Tidak Dapat Diputar</h3>
            <p style="margin-bottom: 20px;">Silakan coba beberapa saat lagi atau hubungi administrator.</p>
            <button onclick="location.reload()" style="
                background: #ff0000;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                margin-top: 15px;
            ">Coba Lagi</button>
        </div>
    `;
    
    if (videoElement.tagName === 'IFRAME') {
        videoElement.outerHTML = `<div class="yt-video-container">${errorMessage}</div>`;
    } else {
        videoElement.outerHTML = errorMessage;
    }
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    
    return date.toLocaleDateString('id-ID');
}

// Global functions
window.handleVideoError = handleVideoError;
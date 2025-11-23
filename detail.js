// detail.js (VERSI PRO FINAL - SECURE + SMART RECOMMENDATION)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// ⚠️ PENTING: Pastikan Row Level Security (RLS) diaktifkan di Supabase Anda!
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------
// DOM ELEMENTS
// ------------------------
let videoPlayer;
const titleBelowEl = document.getElementById("movie-title-below");
const descEl = document.getElementById("movie-desc");
const viewCount = document.getElementById("view-count");
const likeBtn = document.getElementById("like-btn");
const favBtn = document.getElementById("fav-btn");
const shareBtn = document.getElementById("share-btn");
const likeCount = document.getElementById("like-count");
const recommendList = document.getElementById("recommend-list");
const toggleDescBtn = document.getElementById("toggle-desc-btn");

const episodesTab = document.getElementById("episodes-tab");
const recommendationsTab = document.getElementById("recommendations-tab");
const episodesContent = document.getElementById("episodes-content");
const recommendationsContent = document.getElementById("recommendations-content");
const episodesList = document.getElementById("episodes-list");

const popup = document.getElementById("login-popup");
const popupCancel = document.getElementById("popup-cancel");
const popupLogin = document.getElementById("popup-login");

// Ad Elements
const adOverlay = document.getElementById("ad-overlay");
const adVideo = document.getElementById("ad-video");
const adCountdown = document.getElementById("ad-seconds");
const adSkipBtn = document.getElementById("ad-skip-btn");

// ------------------------
// STATE & CONFIG
// ------------------------
const params = new URLSearchParams(window.location.search);
const movieId = params.get("id");
let currentUser = null;
let currentMovie = null;
let hasIncrementedViews = false;

// Config Iklan
const VAST_URL = "https://plumprush.com/d/m.FpzddGGnNHvPZ/G/Ue/Ye/mz9KucZ-UulikSPoTqYo2yO/TVIY4ZM/DpIxt/NcjlYe5NMdjbgdwEMmwp";
const SKIP_AFTER_SECONDS = 5; 
const MIDROLL_OFFSET_SECONDS = 900; 
const ADS_SESSION_KEY = `ads_shown_${movieId}`; 

let adFlags = { pre: false, mid: false, post: false };

// ------------------------
// INITIALIZATION
// ------------------------
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventListeners();
});

async function initializeApp() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) currentUser = session.user;

    await loadMovie();

    const stored = sessionStorage.getItem(ADS_SESSION_KEY);
    if (stored) {
      try { adFlags = { ...adFlags, ...JSON.parse(stored) }; } catch (e) {}
    }
  } catch (err) {
    console.error('Init Error', err);
    showError('Gagal memuat aplikasi. Periksa koneksi internet.');
  }
}

// ------------------------
// EVENT LISTENERS
// ------------------------
function setupEventListeners() {
  if (popupCancel) popupCancel.onclick = () => popup.classList.add("hidden");
  if (popupLogin) popupLogin.onclick = () => window.location.href = "loginuser.html";

  const backBtn = document.getElementById("back-btn");
  if (backBtn) backBtn.onclick = () => window.location.href = "index.html";

  if (likeBtn) likeBtn.onclick = handleLike;
  if (favBtn) favBtn.onclick = handleFavorite;
  if (shareBtn) shareBtn.onclick = handleShare;

  if (episodesTab) episodesTab.onclick = () => switchTab('episodes');
  if (recommendationsTab) recommendationsTab.onclick = () => switchTab('recommendations');

  if (adSkipBtn) adSkipBtn.onclick = stopAdAndResume;

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      await Promise.all([checkLikeStatus(), checkFavoriteStatus()]);
      if (popup) popup.classList.add("hidden");
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
    }
  });
}

// ------------------------
// CORE LOGIC
// ------------------------
async function loadMovie() {
  if (!movieId) return showError('ID film tidak ditemukan di URL');

  try {
    const { data, error } = await supabase.from("movies").select("*").eq("id", movieId).single();
    if (error || !data) throw new Error('Film tidak ditemukan');

    currentMovie = data;
    await displayMovieData();
    await Promise.all([checkLikeStatus(), checkFavoriteStatus()]);

    const seriesTitle = extractSeriesTitle(currentMovie.title);
    if (seriesTitle) {
      switchTab('episodes');
    } else {
      switchTab('recommendations');
    }
  } catch (err) {
    console.error(err);
    showError('Gagal memuat data film.');
  }
}

async function displayMovieData() {
  if (titleBelowEl) titleBelowEl.textContent = currentMovie.title;
  if (descEl) {
    descEl.textContent = currentMovie.description || "Tidak ada deskripsi.";
    checkDescriptionLength();
  }
  if (viewCount) viewCount.textContent = `👁️ ${currentMovie.views || 0} tayangan`;

  let videoUrl = currentMovie.video_url;
  videoUrl = await processVideoUrl(videoUrl);

  videoPlayer = document.getElementById("video-player");
  if (!videoPlayer) return;

  const isEmbed = videoUrl.includes('youtube.com/embed') || videoUrl.includes('drive.google.com') || (videoUrl.includes('gofile.io') && !videoUrl.endsWith('.mp4'));

  if (isEmbed) {
    videoPlayer.src = videoUrl;
    videoPlayer.style.display = 'block';
    attemptPreRollForIframe();
  } else {
    replaceIframeWithVideoPlayer(videoUrl);
  }
}

// ------------------------
// VIDEO PLAYER LOGIC
// ------------------------
function replaceIframeWithVideoPlayer(videoUrl) {
  const oldPlayer = document.getElementById('video-player');
  const newVideo = document.createElement('video');
  newVideo.id = 'video-player';
  newVideo.controls = true;
  newVideo.playsInline = true;
  newVideo.setAttribute('webkit-playsinline', 'true');
  newVideo.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; object-fit:contain;";
  newVideo.src = videoUrl;
  
  oldPlayer.replaceWith(newVideo);
  videoPlayer = newVideo;

  videoPlayer.addEventListener('loadeddata', () => {
    console.log('Video ready');
    updateViewCount();
  });
  
  videoPlayer.addEventListener('play', () => {
    if (!hasIncrementedViews) updateViewCount();
  });

  videoPlayer.addEventListener('ended', handleMainVideoEnded);
  
  videoPlayer.addEventListener('error', () => {
    showError('Gagal memutar video. Format mungkin tidak didukung atau link kadaluarsa.');
  });

  videoPlayer.addEventListener('loadedmetadata', () => {
    if (!adFlags.pre) {
      playPreRollThen(() => console.log('Preroll done'));
    }
    setupMidrollMonitor(videoPlayer);
  });
}

async function processVideoUrl(url) {
  if (!url) return '';
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const id = url.includes("v=") ? new URL(url).searchParams.get("v") : url.split("/").pop();
    return `https://www.youtube.com/embed/${id}?autoplay=0`;
  }
  if (!url.startsWith("http")) {
    const { data } = supabase.storage.from("videos").getPublicUrl(url);
    return data.publicUrl;
  }
  return url; 
}

// ------------------------
// ADS SYSTEM (VAST + TRACKING)
// ------------------------
function firePixel(url) {
  if (!url) return;
  const img = new Image();
  img.src = url;
}

async function fetchVastAndTrack(vastUrl) {
  try {
    const r = await fetch(vastUrl);
    if (!r.ok) throw new Error('VAST Fetch Failed');
    const text = await r.text();
    const xml = new DOMParser().parseFromString(text, "application/xml");

    const mediaFiles = Array.from(xml.getElementsByTagName("MediaFile"));
    let mediaUrl = null;
    for (const mf of mediaFiles) {
      const type = mf.getAttribute('type') || '';
      const content = mf.textContent.trim();
      if ((type.includes('mp4') || content.endsWith('.mp4')) && content) {
        mediaUrl = content;
        break;
      }
    }
    if (!mediaUrl) {
        const anyUrl = xml.querySelector("MediaFile, VASTAdTagURI");
        if (anyUrl) mediaUrl = anyUrl.textContent.trim();
    }

    const impressions = [];
    xml.querySelectorAll("Impression").forEach(n => {
        if(n.textContent.trim()) impressions.push(n.textContent.trim());
    });

    return { mediaUrl, impressions };

  } catch (e) {
    console.warn('VAST Error:', e);
    return { mediaUrl: null, impressions: [] };
  }
}

async function playAdFromMediaUrl(mediaUrl, impressions = []) {
  return new Promise((resolve) => {
    if (!adOverlay || !adVideo) return resolve();
    impressions.forEach(url => firePixel(url));

    adOverlay.classList.remove('hidden');
    adOverlay.setAttribute('aria-hidden', 'false');
    adVideo.src = mediaUrl;
    adVideo.currentTime = 0;
    
    adVideo.play().catch(e => {
        adVideo.muted = true;
        adVideo.play();
    });

    let skipShown = false;
    const tick = setInterval(() => {
        const left = Math.ceil(adVideo.duration - adVideo.currentTime);
        adCountdown.innerHTML = `Iklan: ${left > 0 ? left : 0}s`;
        if (!skipShown && adVideo.currentTime >= SKIP_AFTER_SECONDS) {
            skipShown = true;
            adSkipBtn.classList.remove('hidden');
        }
    }, 500);

    const cleanup = () => {
        clearInterval(tick);
        adOverlay.classList.add('hidden');
        adVideo.pause();
        adVideo.src = "";
        adSkipBtn.classList.add('hidden');
        resolve();
    };

    adVideo.onended = cleanup;
    adVideo.onerror = cleanup;
    adSkipBtn.onclick = cleanup;
  });
}

async function playPreRollThen(cb) {
  if (adFlags.pre) return cb && cb();
  if (videoPlayer && !videoPlayer.paused && videoPlayer.pause) videoPlayer.pause();

  const { mediaUrl, impressions } = await fetchVastAndTrack(VAST_URL);
  if (mediaUrl) {
    await playAdFromMediaUrl(mediaUrl, impressions);
  }
  
  adFlags.pre = true;
  sessionStorage.setItem(ADS_SESSION_KEY, JSON.stringify(adFlags));
  if (cb) cb();
  if (videoPlayer && videoPlayer.play) videoPlayer.play();
}

function setupMidrollMonitor(video) {
    video.addEventListener('timeupdate', () => {
        if (!adFlags.mid && video.currentTime > MIDROLL_OFFSET_SECONDS) {
            adFlags.mid = true;
            video.pause();
            fetchVastAndTrack(VAST_URL).then(({mediaUrl, impressions}) => {
                if(mediaUrl) playAdFromMediaUrl(mediaUrl, impressions).then(() => video.play());
                else video.play();
            });
        }
    });
}

async function handleMainVideoEnded() {
    if (adFlags.post) return;
    const { mediaUrl, impressions } = await fetchVastAndTrack(VAST_URL);
    if (mediaUrl) {
        await playAdFromMediaUrl(mediaUrl, impressions);
        adFlags.post = true;
        sessionStorage.setItem(ADS_SESSION_KEY, JSON.stringify(adFlags));
    }
}

function stopAdAndResume() {}

function attemptPreRollForIframe() {
    if (adFlags.pre) return;
    fetchVastAndTrack(VAST_URL).then(({mediaUrl, impressions}) => {
        if (mediaUrl) {
            playAdFromMediaUrl(mediaUrl, impressions).then(() => {
                adFlags.pre = true;
                sessionStorage.setItem(ADS_SESSION_KEY, JSON.stringify(adFlags));
            });
        }
    });
}

// ------------------------
// TAB & CONTENT LOGIC (SECURE)
// ------------------------
function switchTab(tab) {
  if (episodesTab) episodesTab.classList.toggle('active', tab === 'episodes');
  if (recommendationsTab) recommendationsTab.classList.toggle('active', tab === 'recommendations');
  if (episodesContent) episodesContent.classList.toggle('active', tab === 'episodes');
  if (recommendationsContent) recommendationsContent.classList.toggle('active', tab === 'recommendations');
  
  if (tab === 'episodes') loadEpisodes();
  else loadRecommendations();
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

async function loadEpisodes() {
  if (!currentMovie) return;
  const seriesTitle = extractSeriesTitle(currentMovie.title);
  
  if (!seriesTitle) {
      episodesList.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:20px; color:#aaa;">Tidak ada episode lain.</div>';
      return;
  }

  const { data } = await supabase.from("movies")
      .select("id, title, thumbnail_url, views, duration")
      .ilike("title", `${seriesTitle}%`)
      .order("created_at", { ascending: true });

  if (!data || data.length === 0) {
      episodesList.innerHTML = '<div style="grid-column:1/-1;">Tidak ada data.</div>';
      return;
  }

  episodesList.innerHTML = data.map(m => {
      const isCurr = m.id === currentMovie.id ? 'current' : '';
      const epsNum = extractEpisodeNumber(m.title);
      return `
        <div class="episode-item ${isCurr}" onclick="handleEpisodeNavigation('${m.id}')">
          <div class="episode-thumbnail-container">
            <img src="${escapeHtml(m.thumbnail_url)}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x169?text=No+Image'">
          </div>
          <div class="episode-info">
            <div class="episode-number">${epsNum ? 'Episode '+epsNum : ''}</div>
            <p class="episode-title">${escapeHtml(m.title)}</p>
            <div class="episode-meta">
              <span>👁️ ${m.views||0}</span>
              <span>${escapeHtml(m.duration||'')}</span>
            </div>
          </div>
        </div>
      `;
  }).join('');
}

// ==========================================
// REKOMENDASI CERDAS (GENRE + ACAK) - UPDATED
// ==========================================
async function loadRecommendations() {
    if (!currentMovie) return;
    
    const RECOMMENDATION_LIMIT = 12;
    let finalMovies = [];
    let existingIds = new Set(); 
    existingIds.add(currentMovie.id);

    try {
        // 1. Cari berdasarkan GENRE
        if (currentMovie.genre) {
            const mainGenre = currentMovie.genre.split(',')[0].trim();
            const { data: genreData } = await supabase
                .from("movies")
                .select("id, title, thumbnail_url, views, genre")
                .neq("id", currentMovie.id)
                .ilike("genre", `%${mainGenre}%`)
                .limit(RECOMMENDATION_LIMIT);

            if (genreData && genreData.length > 0) {
                finalMovies = [...genreData];
                genreData.forEach(m => existingIds.add(m.id));
            }
        }

        // 2. Isi sisa dengan FILM ACAK (Fallback)
        if (finalMovies.length < RECOMMENDATION_LIMIT) {
            const slotsNeeded = RECOMMENDATION_LIMIT - finalMovies.length;
            const { data: randomData } = await supabase
                .from("movies")
                .select("id, title, thumbnail_url, views, genre")
                .neq("id", currentMovie.id)
                .limit(40); 

            if (randomData && randomData.length > 0) {
                const uniqueRandoms = randomData.filter(m => !existingIds.has(m.id));
                const shuffled = uniqueRandoms.sort(() => 0.5 - Math.random());
                const fillers = shuffled.slice(0, slotsNeeded);
                finalMovies = [...finalMovies, ...fillers];
            }
        }

        // 3. Render
        if (finalMovies.length === 0) {
            recommendList.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#888;">Belum ada rekomendasi.</div>';
            return;
        }

        recommendList.innerHTML = finalMovies.map(m => `
          <div class="recommend-item" onclick="handleRecommendationNavigation('${m.id}')">
            <div class="recommend-thumbnail-container">
              <img src="${escapeHtml(m.thumbnail_url)}" loading="lazy" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            </div>
            <div class="recommend-info">
              <p class="recommend-title-text">${escapeHtml(m.title)}</p>
              <div class="recommend-meta">
                <span>👁️ ${m.views || 0}</span>
                ${m.genre ? `<span class="genre">${escapeHtml(m.genre.split(',')[0])}</span>` : ''}
              </div>
            </div>
          </div>
        `).join('');

    } catch (err) {
        console.error('Recommendation Error:', err);
        recommendList.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#888;">Gagal memuat rekomendasi.</div>';
    }
}

// ------------------------
// UTILS
// ------------------------
function extractSeriesTitle(title) {
  if (!title) return null;
  const match = title.match(/(.*?)\s*(?:Episode|Ep|Part|Ch)\s*\d+/i);
  return match ? match[1].trim() : null;
}

function extractEpisodeNumber(title) {
  const match = title.match(/(?:Episode|Ep|Part)\s*(\d+)/i);
  return match ? match[1] : '';
}

function checkDescriptionLength() {
  if (descEl.scrollHeight > descEl.clientHeight) {
      toggleDescBtn.classList.remove('hidden');
      toggleDescBtn.onclick = () => {
          descEl.classList.toggle('description-collapsed');
          toggleDescBtn.textContent = descEl.classList.contains('description-collapsed') ? 'Selengkapnya' : 'Sembunyikan';
      };
      descEl.classList.add('description-collapsed');
  }
}

function showError(msg) {
    const d = document.createElement('div');
    d.innerHTML = `<div class="popup-overlay"><div class="popup-box error-popup"><h3>Error</h3><p>${msg}</p><button onclick="this.parentElement.parentElement.remove()" class="popup-ok-btn">OK</button></div></div>`;
    document.body.appendChild(d.firstChild);
}

// Update View Count Logic
async function updateViewCount() {
    if (hasIncrementedViews || !currentMovie) return;
    hasIncrementedViews = true;
    const viewKey = `viewed_${currentMovie.id}`;
    if (sessionStorage.getItem(viewKey)) return;

    await supabase.rpc('increment_views', { movie_id: currentMovie.id });
    sessionStorage.setItem(viewKey, '1');
}

// Like & Fav Logic Simpel
async function checkLikeStatus() {
    if (!currentUser) return;
    const { data } = await supabase.from("likes").select("id").match({movie_id: currentMovie.id, user_id: currentUser.id});
    if (likeBtn) data && data.length ? likeBtn.classList.add("liked") : likeBtn.classList.remove("liked");
}
async function checkFavoriteStatus() {
    if (!currentUser) return;
    const { data } = await supabase.from("favorites").select("id").match({movie_id: currentMovie.id, user_id: currentUser.id});
    if (favBtn) data && data.length ? favBtn.classList.add("favorited") : favBtn.classList.remove("favorited");
}

async function handleLike() {
    if (!currentUser) return popup.classList.remove("hidden");
    const isLiked = likeBtn.classList.contains("liked");
    if (isLiked) {
        await supabase.from("likes").delete().match({movie_id: currentMovie.id, user_id: currentUser.id});
        likeBtn.classList.remove("liked");
    } else {
        await supabase.from("likes").insert({movie_id: currentMovie.id, user_id: currentUser.id});
        likeBtn.classList.add("liked");
    }
}
async function handleFavorite() {
    if (!currentUser) return popup.classList.remove("hidden");
    const isFav = favBtn.classList.contains("favorited");
    if (isFav) {
        await supabase.from("favorites").delete().match({movie_id: currentMovie.id, user_id: currentUser.id});
        favBtn.classList.remove("favorited");
    } else {
        await supabase.from("favorites").insert({movie_id: currentMovie.id, user_id: currentUser.id});
        favBtn.classList.add("favorited");
    }
}
function handleShare() {
    const data = { title: currentMovie.title, url: window.location.href };
    if (navigator.share) navigator.share(data);
    else {
        navigator.clipboard.writeText(data.url);
        alert('Link disalin!');
    }
}

// Global Expose
window.handleEpisodeNavigation = (id) => window.location.href = `detail.html?id=${id}`;
window.handleRecommendationNavigation = (id) => window.location.href = `detail.html?id=${id}`;
window.stopAdAndResume = stopAdAndResume;
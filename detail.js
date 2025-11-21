// detail.js (VERSI PRO FINAL)
// Menggunakan Supabase client (sama seperti original)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

// Konfigurasi Supabase (tidak diubah)
const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWRveWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ------------------------
// ELEMENT REFERENCES
// ------------------------
let videoPlayer = document.getElementById("video-player"); // may be iframe initially
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

// Ad overlay elements
const adOverlay = document.getElementById("ad-overlay");
const adVideo = document.getElementById("ad-video");
const adCountdown = document.getElementById("ad-seconds");
const adSkipBtn = document.getElementById("ad-skip-btn");

// Data & state
const params = new URLSearchParams(window.location.search);
const movieId = params.get("id");
let currentUser = null;
let currentMovie = null;
let hasIncrementedViews = false;
let episodeClickCount = 0;
let lastEpisodeClickTime = 0;

// Ad config
const VAST_URL = "https://plumprush.com/d/m.FpzddGGnNHvPZ/G/Ue/Ye/mz9KucZ-UulikSPoTqYo2yO/TVIY4ZM/DpIxt/NcjlYe5NMdjbgdwEMmwp";
const SKIP_AFTER_SECONDS = 10; // user chose option C
const MIDROLL_OFFSET_SECONDS = 900; // 15 minutes
const MIN_DURATION_FOR_MIDROLL = 300; // 5 minutes
const ADS_SESSION_KEY = `ads_shown_${movieId}`; // per-episode storage key

// Will store ad shown flags
let adFlags = {
  pre: false,
  mid: false,
  post: false
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventListeners();
});

// ------------------------
// INITIALIZE APP
// ------------------------
async function initializeApp() {
  showLoading(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) currentUser = session.user;

    // Load movie and UI
    await loadMovie();

    // Restore ad flags from sessionStorage (per-episode), if exists
    const stored = sessionStorage.getItem(ADS_SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        adFlags = { ...adFlags, ...parsed };
      } catch (e) { /* ignore */ }
    }

  } catch (err) {
    console.error('initializeApp error', err);
    showError('Gagal memuat aplikasi');
  } finally {
    showLoading(false);
  }
}

// ------------------------
// SETUP EVENT LISTENERS
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

  // Ads skip button
  if (adSkipBtn) adSkipBtn.onclick = () => {
    // immediate stop ad and resume main video
    stopAdAndResume();
  }

  // session auth change
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

// ------------------------
// LOAD MOVIE
// ------------------------
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
      console.error('Error loading movie', error);
      showError('Gagal memuat data film');
      return;
    }
    if (!data) {
      showError('Film tidak ditemukan');
      return;
    }

    currentMovie = data;
    await displayMovieData();

    await Promise.all([ checkLikeStatus(), checkFavoriteStatus() ]);

    // Default tab based on series
    const seriesTitle = extractSeriesTitle(currentMovie.title);
    if (seriesTitle) setTimeout(() => switchTab('episodes'), 100);
    else setTimeout(() => switchTab('recommendations'), 100);

  } catch (err) {
    console.error('loadMovie exception', err);
    showError('Terjadi kesalahan saat memuat film');
  }
}

// ------------------------
// DISPLAY MOVIE DATA & PREPARE PLAYER
// ------------------------
async function displayMovieData() {
  if (titleBelowEl) titleBelowEl.textContent = currentMovie.title;
  if (descEl) {
    descEl.textContent = currentMovie.description || "Tidak ada deskripsi.";
    checkDescriptionLength();
  }
  if (viewCount) viewCount.textContent = `👁️ ${currentMovie.views || 0} tayangan`;

  let videoUrl = currentMovie.video_url;
  videoUrl = await processVideoUrl(videoUrl);
  console.log('Final Video URL:', videoUrl);

  if (videoUrl.includes('youtube.com/embed') || videoUrl.includes('drive.google.com') || videoUrl.includes('gofile.io')) {
    // keep iframe for these
    if (videoPlayer) {
      videoPlayer.src = videoUrl;
      videoPlayer.style.display = 'block';
    }
    // Because it's iframe cross-origin we cannot reliably control video; still attempt pre-roll using overlay but won't pause iframe
    attemptPreRollForIframe();
  } else {
    // Use HTML5 player for direct video files (Cloudflare R2 / Wasabi / Supabase)
    replaceIframeWithVideoPlayer(videoUrl);
  }
}

// ------------------------
// PROCESS VIDEO URL (original logic preserved)
// ------------------------
async function processVideoUrl(videoUrl) {
  if (!videoUrl) return '';

  // YouTube handling
  if (videoUrl.includes("youtube.com/watch?v=")) {
    const id = new URL(videoUrl).searchParams.get("v");
    return `https://www.youtube.com/embed/${id}?autoplay=0`;
  } else if (videoUrl.includes("youtu.be/")) {
    const id = videoUrl.split("youtu.be/")[1];
    return `https://www.youtube.com/embed/${id}?autoplay=0`;
  } else if (videoUrl.includes("drive.google.com")) {
    if (videoUrl.includes("/file/d/")) {
      const fileId = videoUrl.split('/file/d/')[1].split('/')[0];
      return `https://drive.google.com/file/d/${fileId}/preview`;
    } else if (videoUrl.includes("id=")) {
      const fileId = new URL(videoUrl).searchParams.get("id");
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
  } else if (videoUrl.includes("wasabisys.com") || videoUrl.includes("s3.wasabisys.com")) {
    return videoUrl;
  } else if (videoUrl.includes("gofile.io")) {
    return await processGoFileUrl(videoUrl);
  } else if (!videoUrl.startsWith("http")) {
    const { data: urlData } = supabase.storage.from("videos").getPublicUrl(videoUrl);
    return urlData.publicUrl;
  }

  return videoUrl;
}

// ------------------------
// GOFILE PROCESSOR (kept from original)
// ------------------------
async function processGoFileUrl(gofileUrl) {
  try {
    let contentId;
    if (gofileUrl.includes('/d/')) contentId = gofileUrl.split('/d/')[1];
    else {
      const parts = gofileUrl.split('/');
      contentId = parts[parts.length - 1];
    }
    if (!contentId) return gofileUrl;

    const apiResponse = await fetch(`https://api.gofile.io/getContent?contentId=${contentId}&token=`);
    const apiData = await apiResponse.json();

    if (apiData.status === 'ok' && apiData.data) {
      const findVideoFile = (content) => {
        if (content.type === 'file' && isVideoFile(content.name)) return content;
        if (content.contents) {
          for (const key in content.contents) {
            const result = findVideoFile(content.contents[key]);
            if (result) return result;
          }
        }
        return null;
      };
      const videoFile = findVideoFile(apiData.data);
      if (videoFile && videoFile.link) return videoFile.link;
    }
    return gofileUrl;
  } catch (err) {
    console.error('processGoFileUrl error', err);
    return gofileUrl;
  }
}

function isVideoFile(filename) {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v', '.3gp'];
  return videoExtensions.some(ext => filename.toLowerCase().endsWith(ext));
}

// ------------------------
// REPLACE IFRAME WITH HTML5 VIDEO (augmented to wire ad logic)
// ------------------------
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
  newVideoPlayer.preload = 'metadata';
  newVideoPlayer.playsInline = true;
  newVideoPlayer.setAttribute('webkit-playsinline', 'true');

  const source = document.createElement('source');
  source.src = videoUrl;
  source.type = getVideoMimeType(videoUrl);

  newVideoPlayer.appendChild(source);
  newVideoPlayer.innerHTML += 'Browser Anda tidak mendukung pemutar video.';

  videoPlayer.replaceWith(newVideoPlayer);
  // rebind reference
  videoPlayer = document.getElementById('video-player');

  // Add listeners for view increment and ad integration
  videoPlayer.addEventListener('loadeddata', handleVideoLoad);
  videoPlayer.addEventListener('play', handleVideoPlay);
  videoPlayer.addEventListener('error', handleVideoError);
  videoPlayer.addEventListener('ended', handleMainVideoEnded);

  // Once metadata loaded, trigger pre-roll (if not already shown)
  videoPlayer.addEventListener('loadedmetadata', () => {
    // Immediately run pre-roll before allowing user to play (unless pre already shown)
    if (!adFlags.pre) {
      playPreRollThen(() => {
        // allow user to play after pre-roll
        // don't autostart main video — keep user initiated or resume
      });
    }
    // Setup midroll monitor
    setupMidrollMonitor(videoPlayer);
  });
}

// ------------------------
// MIME helper
// ------------------------
function getVideoMimeType(videoUrl) {
  if (videoUrl.includes('.mp4')) return 'video/mp4';
  if (videoUrl.includes('.webm')) return 'video/webm';
  if (videoUrl.includes('.ogg')) return 'video/ogg';
  if (videoUrl.includes('.mov')) return 'video/quicktime';
  return 'video/mp4';
}

// ------------------------
// PRE / MID / POST AD FLOW
// ------------------------

// Utility: fetch VAST xml and extract a direct MediaFile (mp4/webm) URL (simple approach)
async function fetchVastMediaUrl(vastUrl) {
  try {
    const r = await fetch(vastUrl, { method: 'GET', mode: 'cors' });
    if (!r.ok) throw new Error('VAST fetch failed');
    const text = await r.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "application/xml");

    // Try to find MediaFile elements with common types
    const mediaFiles = Array.from(xml.getElementsByTagName("MediaFile"));
    for (const mf of mediaFiles) {
      const ctype = mf.getAttribute('type') || '';
      const url = mf.textContent && mf.textContent.trim();
      if (!url) continue;
      if (/(mp4|webm|ogg)/i.test(ctype) || /\.(mp4|webm|ogg)(\?|$)/i.test(url)) {
        return url;
      }
    }

    // fallback: search any URL-looking nodes
    const urlNodes = xml.querySelectorAll("MediaFile, MediaFiles, VASTAdTagURI, Wrapper, URL");
    for (const node of urlNodes) {
      const txt = node.textContent && node.textContent.trim();
      if (txt && /\.(mp4|webm|ogg)(\?|$)/i.test(txt)) return txt;
    }

    // If no direct media found, return null (may be wrapper)
    return null;
  } catch (err) {
    console.warn('fetchVastMediaUrl error', err);
    return null;
  }
}

// Show ad overlay and play given media URL
async function playAdFromMediaUrl(mediaUrl) {
  return new Promise((resolve) => {
    if (!adOverlay || !adVideo) return resolve();

    // Setup UI
    adOverlay.classList.remove('hidden');
    adOverlay.setAttribute('aria-hidden', 'false');
    adVideo.src = mediaUrl;
    adVideo.currentTime = 0;
    adVideo.muted = false;
    adVideo.play().catch((e) => {
      console.warn('Ad play error', e);
      // if autoplay blocked, show overlay and allow click to play
    });

    // Countdown & skip logic
    let adDuration = 0;
    let skipShown = false;
    const onLoadedMeta = () => {
      adDuration = Math.floor(adVideo.duration) || 0;
      // set initial countdown
      adCountdown.textContent = adDuration;
    };
    adVideo.addEventListener('loadedmetadata', onLoadedMeta, { once: true });

    // update timer
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((adVideo.duration || 0) - adVideo.currentTime));
      adCountdown.textContent = remaining;
      // Show skip after SKIP_AFTER_SECONDS elapsed
      if (!skipShown && adVideo.currentTime >= SKIP_AFTER_SECONDS) {
        skipShown = true;
        adSkipBtn.classList.remove('hidden');
      }
    }, 300);

    // When ad ends or skipped
    const cleanupAndResolve = () => {
      clearInterval(interval);
      adVideo.pause();
      adVideo.removeAttribute('src');
      try { adVideo.load(); } catch (e) {}
      adOverlay.classList.add('hidden');
      adOverlay.setAttribute('aria-hidden', 'true');
      adSkipBtn.classList.add('hidden');
      adCountdown.textContent = '0';
      resolve();
    };

    adVideo.addEventListener('ended', cleanupAndResolve, { once: true });
    adVideo.addEventListener('error', (e) => {
      console.warn('Ad playback error', e);
      cleanupAndResolve();
    }, { once: true });

    // If user clicks skip, cleanup
    adSkipBtn.onclick = () => {
      cleanupAndResolve();
    };
  });
}

// Play pre-roll then callback
async function playPreRollThen(cb) {
  if (adFlags.pre) {
    if (typeof cb === 'function') cb();
    return;
  }
  // If ad already shown in session, skip
  if (sessionStorage.getItem(ADS_SESSION_KEY)) {
    const parsed = JSON.parse(sessionStorage.getItem(ADS_SESSION_KEY));
    if (parsed && parsed.pre) {
      adFlags.pre = true;
      if (cb) cb();
      return;
    }
  }

  // Try to fetch media URL from VAST
  const mediaUrl = await fetchVastMediaUrl(VAST_URL);
  if (!mediaUrl) {
    console.warn('No direct media found in VAST for pre-roll, skipping pre-roll');
    adFlags.pre = true;
    persistAdFlags();
    if (cb) cb();
    return;
  }

  // Pause main video if possible
  try { videoPlayer.pause(); } catch (e) { /* ignore */ }

  // Play ad
  await playAdFromMediaUrl(mediaUrl);
  adFlags.pre = true;
  persistAdFlags();

  if (typeof cb === 'function') cb();
}

// Setup midroll monitor
function setupMidrollMonitor(mainVideo) {
  if (!mainVideo) return;

  function onTimeUpdate() {
    if (adFlags.mid) return; // already played
    if (mainVideo.duration && mainVideo.duration > MIN_DURATION_FOR_MIDROLL) {
      if (mainVideo.currentTime >= MIDROLL_OFFSET_SECONDS) {
        // mark flagged to prevent duplicates
        adFlags.mid = true;
        persistAdFlags();

        // Pause main and attempt mid-roll
        mainVideo.pause();
        attemptPlayAdThenResume(mainVideo).catch(() => {
          // resume even if ad failed
          try { mainVideo.play(); } catch (e) {}
        });
      }
    }
  }

  mainVideo.addEventListener('timeupdate', onTimeUpdate);
}

// When main video ends -> post-roll
async function handleMainVideoEnded() {
  if (adFlags.post) return;
  adFlags.post = true;
  persistAdFlags();

  const mediaUrl = await fetchVastMediaUrl(VAST_URL);
  if (!mediaUrl) {
    console.warn('No direct media found in VAST for post-roll, skipping');
    return;
  }
  // Play post-roll (no resume needed)
  await playAdFromMediaUrl(mediaUrl);
}

// Attempt play ad (for mid/post) then resume main
async function attemptPlayAdThenResume(mainVideo) {
  const mediaUrl = await fetchVastMediaUrl(VAST_URL);
  if (!mediaUrl) {
    console.warn('No media for midroll');
    try { mainVideo.play(); } catch (e) {}
    return;
  }
  await playAdFromMediaUrl(mediaUrl);
  try { mainVideo.play(); } catch (e) { console.warn('Could not resume main video', e); }
}

// Stop ad and resume main video immediately (skip handler)
function stopAdAndResume() {
  // hide ad overlay and resume main
  try {
    adVideo.pause();
    adVideo.removeAttribute('src');
    adVideo.load();
  } catch (e) {}
  adOverlay.classList.add('hidden');
  adOverlay.setAttribute('aria-hidden', 'true');
  adSkipBtn.classList.add('hidden');

  // resume main video if possible
  try { videoPlayer.play(); } catch (e) {}
}

// In case of iframe (cross-origin) we still show a small pre-roll notice or try to open ad in overlay
async function attemptPreRollForIframe() {
  // If we cannot pause iframe, we still show ad overlay once
  if (adFlags.pre) return;
  const mediaUrl = await fetchVastMediaUrl(VAST_URL);
  if (!mediaUrl) {
    adFlags.pre = true;
    persistAdFlags();
    return;
  }
  // Show overlay ad, but we cannot pause iframe; after ad finishes, just hide overlay
  await playAdFromMediaUrl(mediaUrl);
  adFlags.pre = true;
  persistAdFlags();
}

// Persist adFlags to sessionStorage (per-episode)
function persistAdFlags() {
  try {
    sessionStorage.setItem(ADS_SESSION_KEY, JSON.stringify(adFlags));
  } catch (e) { /* ignore */ }
}

// ------------------------
// VIEW COUNT / LIKE / FAVORITE (original logic preserved)
// ------------------------
async function updateViewCount() {
  if (!currentMovie || hasIncrementedViews) return;

  const id = currentMovie.id;
  try {
    const viewKey = `viewed_${id}`;
    const hasViewed = sessionStorage.getItem(viewKey);
    if (hasViewed) return;

    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('increment_views', { movie_id: id });
    if (rpcError) {
      // fallback
      const { data: movieData } = await supabase.from("movies").select("views").eq("id", id).single();
      if (movieData) {
        const newViews = (movieData.views || 0) + 1;
        const { error: updateError } = await supabase.from("movies").update({ views: newViews }).eq("id", id);
        if (!updateError && viewCount) viewCount.textContent = `👁️ ${newViews} tayangan`;
      }
    } else {
      const { data: updatedMovie } = await supabase.from("movies").select("views").eq("id", id).single();
      if (updatedMovie && viewCount) viewCount.textContent = `👁️ ${updatedMovie.views || 0} tayangan`;
    }

    sessionStorage.setItem(viewKey, 'true');
    hasIncrementedViews = true;
    await recordWatchHistory();

  } catch (err) {
    console.error('updateViewCount error', err);
  }
}

async function recordWatchHistory() {
  if (!currentUser || !currentMovie) return;
  try {
    await supabase.from("watch_history").upsert({
      user_id: currentUser.id,
      movie_id: currentMovie.id,
      watched_at: new Date().toISOString()
    });
  } catch (err) { console.error('recordWatchHistory error', err); }
}

async function handleLike() {
  if (!currentUser || !currentMovie) {
    showLoginPopup("menyukai film");
    return;
  }
  try {
    const { data: existingLike } = await supabase.from("likes").select("id").eq("movie_id", currentMovie.id).eq("user_id", currentUser.id).single();
    if (existingLike) {
      await supabase.from("likes").delete().eq("id", existingLike.id);
      if (likeBtn) likeBtn.classList.remove("liked");
      showSuccessPopup('Like dihapus');
    } else {
      await supabase.from("likes").insert({ movie_id: currentMovie.id, user_id: currentUser.id });
      if (likeBtn) likeBtn.classList.add("liked");
      showSuccessPopup('Film disukai!');
    }
    await updateLikeCount();
  } catch (err) {
    console.error('handleLike error', err); showError('Gagal memperbarui like');
  }
}

async function handleFavorite() {
  if (!currentUser || !currentMovie) {
    showLoginPopup("menambah favorit");
    return;
  }
  try {
    const { data: existingFav } = await supabase.from("favorites").select("id").eq("movie_id", currentMovie.id).eq("user_id", currentUser.id).single();
    if (existingFav) {
      await supabase.from("favorites").delete().eq("id", existingFav.id);
      if (favBtn) favBtn.classList.remove("favorited");
      showSuccessPopup('Dihapus dari favorit');
    } else {
      await supabase.from("favorites").insert({ movie_id: currentMovie.id, user_id: currentUser.id });
      if (favBtn) favBtn.classList.add("favorited");
      showSuccessPopup('Ditambahkan ke favorit!');
    }
  } catch (err) {
    console.error('handleFavorite error', err); showError('Gagal memperbarui favorit');
  }
}

function handleShare() {
  const shareUrl = window.location.href;
  const shareText = `Tonton "${currentMovie?.title || 'Film Menarik'}" di Dunia Film`;
  if (navigator.share) {
    navigator.share({ title: currentMovie?.title || 'Dunia Film', text: shareText, url: shareUrl }).catch(() => fallbackShare(shareUrl));
  } else fallbackShare(shareUrl);
}
function fallbackShare(url) {
  navigator.clipboard.writeText(url).then(() => showSuccessPopup('Link berhasil disalin!')).catch(() => prompt('Salin link berikut:', url));
}

async function checkLikeStatus() {
  if (!currentUser || !currentMovie) {
    if (likeBtn) likeBtn.classList.remove("liked");
    return;
  }
  try {
    const { data } = await supabase.from("likes").select("id").eq("movie_id", currentMovie.id).eq("user_id", currentUser.id).single();
    if (data) { if (likeBtn) likeBtn.classList.add("liked"); }
    else { if (likeBtn) likeBtn.classList.remove("liked"); }
    await updateLikeCount();
  } catch (err) { console.error('checkLikeStatus error', err); }
}

async function checkFavoriteStatus() {
  if (!currentUser || !currentMovie) {
    if (favBtn) favBtn.classList.remove("favorited");
    return;
  }
  try {
    const { data } = await supabase.from("favorites").select("id").eq("movie_id", currentMovie.id).eq("user_id", currentUser.id).single();
    if (data) { if (favBtn) favBtn.classList.add("favorited"); }
    else { if (favBtn) favBtn.classList.remove("favorited"); }
  } catch (err) { console.error('checkFavoriteStatus error', err); }
}

async function updateLikeCount() {
  if (!currentMovie) return;
  try {
    const { count } = await supabase.from("likes").select("*", { count: "exact", head: true }).eq("movie_id", currentMovie.id);
    if (likeCount) likeCount.textContent = count || 0;
  } catch (err) { console.error('updateLikeCount error', err); }
}

// ------------------------
// EPISODE / RECOMMENDATIONS (original functions preserved)
// ------------------------
async function loadEpisodes() {
  if (!currentMovie) return;
  try {
    if (episodesList) episodesList.innerHTML = '<div class="loading-episodes">Memuat episode...</div>';
    const seriesTitle = extractSeriesTitle(currentMovie.title);
    if (!seriesTitle) {
      episodesList.innerHTML = '<div class="loading-episodes">Tidak ada episode lainnya.</div>';
      return;
    }
    const { data: episodes, error } = await supabase.from("movies").select("*").ilike("title", `${seriesTitle}%`).order("created_at", { ascending: true });
    if (error) throw error;
    renderEpisodes(episodes || []);
  } catch (err) {
    console.error('loadEpisodes error', err);
    if (episodesList) episodesList.innerHTML = '<div class="loading-episodes">Gagal memuat episode.</div>';
  }
}

function extractSeriesTitle(title) {
  if (!title) return null;
  const episodePatterns = [
    /(.*?)\s*[Ee]pisode\s*\d+/i,
    /(.*?)\s*[Pp]art\s*\d+/i,
    /(.*?)\s*[Cc]hapter\s*\d+/i,
    /(.*?)\s*-\s*[Ee]pisode\s*\d+/i,
    /(.*?)\s*\(\s*[Ee]pisode\s*\d+\s*\)/i,
    /(.*?)\s*\d+$/
  ];
  for (const pattern of episodePatterns) {
    const match = title.match(pattern);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

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
    if (match && match[1]) return parseInt(match[1]);
  }
  return null;
}

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
      <div class="episode-item ${isCurrentEpisode ? 'current' : ''}" onclick="handleEpisodeNavigation('${movie.id}')">
        <div class="episode-thumbnail-container">
          <img src="${movie.thumbnail_url || 'https://via.placeholder.com/200x355?text=No+Thumbnail'}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/200x355?text=No+Thumbnail'" loading="lazy">
        </div>
        <div class="episode-info">
          <div class="episode-number">${episodeNumber ? `Episode ${episodeNumber}` : 'Episode'}</div>
          <p class="episode-title">${escapeHtml(movie.title)}</p>
          <div class="episode-meta">
            <span class="views">👁️ ${movie.views || 0}</span>
            <span class="episode-duration">${movie.duration || '--:--'}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

function handleEpisodeNavigation(id) {
  handleEpisodeClick();
  window.location.href = `detail.html?id=${id}`;
}

// Popunder logic when episodes clicked
function handleEpisodeClick() {
  const currentTime = new Date().getTime();
  if (currentTime - lastEpisodeClickTime > 10000) episodeClickCount = 0;
  episodeClickCount++;
  lastEpisodeClickTime = currentTime;
  if (episodeClickCount % 2 === 0) {
    try { console.log('Popunder triggered after episode click'); } catch (e) { console.log('Popunder error', e); }
  }
}

// ------------------------
// RECOMMENDATIONS (original preserved)
// ------------------------
async function loadRecommendations() {
  if (!currentMovie) return;
  try {
    if (recommendList) recommendList.innerHTML = '<div class="loading-recommendations">Memuat rekomendasi...</div>';
    const { data: randomMovies, error } = await supabase.from("movies").select("*").neq("id", currentMovie.id).limit(40);
    if (error) throw error;
    const seriesTitle = extractSeriesTitle(currentMovie?.title);
    let filteredMovies = randomMovies || [];
    if (seriesTitle) {
      filteredMovies = filteredMovies.filter(movie => extractSeriesTitle(movie.title) !== seriesTitle);
    }
    const shuffled = shuffleArray(filteredMovies).slice(0, 30);
    renderRecommendations(shuffled);
  } catch (err) {
    console.error('loadRecommendations error', err);
    if (recommendList) recommendList.innerHTML = '<div class="loading-recommendations">Gagal memuat rekomendasi.</div>';
  }
}

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function renderRecommendations(movies) {
  if (!recommendList) return;
  if (!movies || movies.length === 0) {
    recommendList.innerHTML = '<div class="loading-recommendations">Tidak ada rekomendasi.</div>';
    return;
  }
  recommendList.innerHTML = movies.map(movie => `
    <div class="recommend-item" onclick="handleRecommendationNavigation('${movie.id}')">
      <div class="recommend-thumbnail-container">
        <img src="${movie.thumbnail_url || 'https://via.placeholder.com/200x355?text=No+Thumbnail'}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/200x355?text=No+Thumbnail'" loading="lazy">
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

function handleRecommendationNavigation(id) {
  handleEpisodeClick();
  window.location.href = `detail.html?id=${id}`;
}

// ------------------------
// UTILITY & UI HELPERS (original preserved)
// ------------------------
function showLoginPopup(action = "melakukan aksi ini") {
  const popupText = document.querySelector(".login-popup p");
  if (popupText) popupText.textContent = `Untuk ${action}, silakan login terlebih dahulu.`;
  if (popup) popup.classList.remove("hidden");
}

function showLoading(show) {
  let loadingEl = document.getElementById('loading-overlay');
  if (!loadingEl && show) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'loading-overlay';
    loadingEl.className = 'loading-overlay';
    loadingEl.innerHTML = `<div class="loading-spinner"></div><p>Memuat...</p>`;
    document.body.appendChild(loadingEl);
  } else if (loadingEl && !show) {
    loadingEl.remove();
  }
}

function showError(message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'error-popup popup-overlay';
  errorEl.innerHTML = `
    <div class="popup-box error-popup">
      <div class="popup-icon">❌</div>
      <h3>Error</h3>
      <p>${message}</p>
      <button class="popup-ok-btn" onclick="this.parentElement.parentElement.remove()">OK</button>
    </div>`;
  document.body.appendChild(errorEl);
}

function showSuccessPopup(message) {
  const successEl = document.createElement('div');
  successEl.className = 'success-popup popup-overlay';
  successEl.innerHTML = `
    <div class="popup-box success-popup">
      <div class="popup-icon">✅</div>
      <h3>Sukses</h3>
      <p>${message}</p>
      <button class="popup-ok-btn" onclick="this.parentElement.parentElement.remove()">OK</button>
    </div>`;
  document.body.appendChild(successEl);
  setTimeout(() => { if (successEl.parentElement) successEl.remove(); }, 3000);
}

function handleVideoError() {
  const videoElement = document.getElementById('video-player');
  if (!videoElement) return;
  const currentSrc = videoElement.src || '';
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
      <button onclick="location.reload()" style="background: #ff0000; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 15px;">Coba Lagi</button>
    </div>`;
  if (videoElement.tagName === 'IFRAME') {
    videoElement.outerHTML = `<div class="yt-video-container">${errorMessage}</div>`;
  } else {
    videoElement.outerHTML = errorMessage;
  }
}

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

// Expose global for inline onclick handlers
window.handleVideoError = handleVideoError;
window.handleEpisodeNavigation = handleEpisodeNavigation;
window.handleRecommendationNavigation = handleRecommendationNavigation;

// End of detail.js
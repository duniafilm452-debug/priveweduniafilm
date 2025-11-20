import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const SUPABASE_URL = "https://kwuqrsnkxlxzqvimoydu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dXFyc25reGx4enF2aW1veWR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTQ5ODUsImV4cCI6MjA3NDk5MDk4NX0.6XQjnexc69VVSzvB5XrL8gFGM54Me9c5TrR20ysfvTk";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Fungsi untuk memeriksa apakah user adalah admin
export async function requireAdminAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        window.location.href = 'login.html';
        return false;
    }
    
    // Cek admin status
    const isAdmin = await checkIfUserIsAdmin(session.user.id);
    
    if (!isAdmin) {
        console.warn('Non-admin user attempted to access admin page:', session.user.email);
        await supabase.auth.signOut();
        window.location.href = 'index.html';
        return false;
    }
    
    return true;
}

async function checkIfUserIsAdmin(userId) {
    try {
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
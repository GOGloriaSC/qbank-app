// components/logActivity.js
import { supabase } from "../supabaseClient";

/**
 * Mencatat aktivitas user ke dalam tabel activities
 * @param {string} action - Jenis aksi (contoh: 'create_question', 'update_question_status')
 * @param {string} description - Deskripsi aktivitas
 * @param {string|null} questionId - ID soal terkait (opsional)
 */
export async function logActivity(action, description, questionId = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.warn("Tidak dapat mencatat aktivitas: user tidak ditemukan.");
      return;
    }

    const { error } = await supabase.from("activities").insert([
      {
        user_id: user.id,
        action: action,
        description: description,
        question_id: questionId,
        created_at: new Date().toISOString(),
      },
    ]);

    if (error) throw error;
  } catch (err) {
    console.error("Gagal mencatat aktivitas:", err);
  }
}
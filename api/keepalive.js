// Chamado todo dia pela Vercel (veja "crons" em vercel.json).
// Faz uma leitura simples no Supabase para que o projeto gratuito
// não seja pausado por inatividade.
const SUPABASE_URL = process.env.SUPABASE_URL || "https://mpaieteubzupedxmyvbb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || "sb_publishable_gGOCF8TTQ6tWWGKnlaTvgQ_EadhJmjA";

export default async function handler(req, res) {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/vacinas?select=id&limit=1`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, em: new Date().toISOString() });
  } catch (e) {
    res.status(502).json({ ok: false, erro: String(e) });
  }
}

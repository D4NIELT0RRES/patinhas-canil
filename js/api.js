// Acesso ao Supabase e regras de vacinas.

const CFG = window.APP_CONFIG || {};
const configurado = !!CFG.SUPABASE_URL && !CFG.SUPABASE_URL.startsWith("COLE_");
const sb = configurado && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

const Store = { animais: [], canis: [], vacinas: [], aplicadas: [], canilPorId: {}, aplicadaPorChave: {} };

async function q(promessa) {
  const { data, error } = await promessa;
  if (error) throw error;
  return data;
}

// O Supabase devolve no máximo 1000 linhas por consulta; busca em páginas.
async function todasAsLinhas(tabela, ordem) {
  const tam = 1000;
  let todas = [];
  for (let de = 0; ; de += tam) {
    const lote = await q(sb.from(tabela).select("*").order(ordem).range(de, de + tam - 1));
    todas = todas.concat(lote);
    if (lote.length < tam) return todas;
  }
}

async function carregarTudo() {
  const [animais, canis, vacinas, aplicadas] = await Promise.all([
    todasAsLinhas("animais", "created_at"),
    todasAsLinhas("canis", "nome"),
    todasAsLinhas("vacinas", "nome"),
    todasAsLinhas("vacinas_aplicadas", "created_at"),
  ]);
  Store.animais = animais;
  Store.canis = canis;
  Store.vacinas = vacinas;
  Store.aplicadas = aplicadas;
  Store.canilPorId = Object.fromEntries(canis.map((c) => [c.id, c]));
  Store.aplicadaPorChave = Object.fromEntries(aplicadas.map((a) => [`${a.animal_id}|${a.vacina_id}`, a]));
}

// ---------- Fotos ----------

// Reduz a foto (lado maior 1200px, JPEG) para caber no plano gratuito do Storage.
async function comprimirImagem(arquivo, ladoMax = 1200) {
  try {
    const img = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
    return blob || arquivo;
  } catch {
    return arquivo;
  }
}

async function enviarFoto(arquivo) {
  const blob = await comprimirImagem(arquivo);
  const caminho = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
  await q(sb.storage.from("fotos").upload(caminho, blob, { contentType: blob.type || "image/jpeg" }));
  return { foto_path: caminho, foto_url: sb.storage.from("fotos").getPublicUrl(caminho).data.publicUrl };
}

async function removerFoto(caminho) {
  if (caminho) await sb.storage.from("fotos").remove([caminho]).catch(() => {});
}

// ---------- Vacinas ----------

const vacinasDoAnimal = (a) => Store.vacinas.filter((v) => v.especie === "ambos" || v.especie === a.especie);

// Situação de cada vacina que se aplica ao animal: em dia, vencida ou falta.
function situacaoVacinas(a) {
  const hoje = hojeISO();
  return vacinasDoAnimal(a).map((vacina) => {
    const ap = Store.aplicadaPorChave[`${a.id}|${vacina.id}`];
    if (!ap) return { vacina, status: "falta", aplicada: null, proxima: null };
    const proxima = addDias(ap.data_aplicacao, vacina.intervalo_dias);
    return { vacina, status: proxima < hoje ? "vencida" : "ok", aplicada: ap.data_aplicacao, proxima };
  });
}

function resumoVacinas(a) {
  const itens = situacaoVacinas(a);
  const conta = (s) => itens.filter((i) => i.status === s).length;
  return { itens, ok: conta("ok"), vencidas: conta("vencida"), faltando: conta("falta"), pendentes: itens.filter((i) => i.status !== "ok") };
}

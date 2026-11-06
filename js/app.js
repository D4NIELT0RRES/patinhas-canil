// Navegação entre telas (pelo # da URL) e inicialização.

// 4º item: a tela pode ser atualizada sozinha quando outro voluntário muda algo
const ROTAS = [
  [/^#\/animais$/, () => viewLista(), "animais", true],
  [/^#\/animal\/novo$/, () => viewForm(null), "animais"],
  [/^#\/animal\/([^/]+)\/editar$/, (id) => viewForm(id), "animais"],
  [/^#\/animal\/([^/]+)(?:\/(saude))?$/, (id, aba) => viewFicha(id, aba), "animais"],
  [/^#\/galeria$/, () => viewGaleria(), "galeria", true],
  [/^#\/vacinas$/, () => viewVacinas(), "vacinas", true],
  [/^#\/canis$/, () => viewCanis(), "canis", true],
  [/^#\/vacinacao$/, () => viewVacinacao(), "pendencias"],
  [/^#\/pendencias$/, () => viewPendencias(), "pendencias", true],
];

function naoEncontrado(texto) {
  $("#app").innerHTML = `<div class="vazio"><p>${esc(texto)}</p><a class="btn" href="#/animais">Voltar para os animais</a></div>`;
}

function mostrarErro(texto, tentarDeNovo) {
  $("#app").innerHTML = `<div class="vazio"><p>${esc(texto)}</p><button class="btn" id="de-novo">Tentar de novo</button></div>`;
  $("#de-novo").onclick = tentarDeNovo;
}

async function recarregar(view) {
  await carregarTudo();
  await view();
}

function telaConfiguracao() {
  $("#app").innerHTML = `<div class="vazio"><p>⚙️ O app ainda não está ligado ao Supabase.</p>
    <p>Abra o arquivo <strong>js/config.js</strong> e cole a URL e a chave do seu projeto. O passo a passo está no <strong>README.md</strong>.</p></div>`;
}

let numeroRender = 0;
let telaAtual = null;
async function rotear() {
  const hash = location.hash || "#/animais";
  const rota = ROTAS.map(([re, fn, menu, aoVivo]) => [hash.match(re), fn, menu, aoVivo]).find(([m]) => m);
  if (!rota) {
    location.hash = "#/animais";
    return;
  }
  const [m, fn, menu, aoVivo] = rota;
  for (const l of document.querySelectorAll("nav a")) l.classList.toggle("ativo", l.dataset.menu === menu);
  if (!sb) return telaConfiguracao();

  const meu = ++numeroRender;
  telaAtual = null; // enquanto carrega, nada de atualização ao vivo
  $("#app").innerHTML = `<div class="carregando"><div class="roda"></div><p>Carregando...</p></div>`;
  try {
    await carregarTudo();
    if (meu !== numeroRender) return; // o usuário já foi para outra tela
    await fn(...m.slice(1));
    telaAtual = { fn: () => fn(...m.slice(1)), aoVivo };
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    if (meu === numeroRender) mostrarErro("Não foi possível carregar os dados. Verifique a internet.", rotear);
  }
}

// ---------- Atualização em tempo real (Supabase Realtime) ----------
// Quando outro voluntário muda algo, as listas se atualizam sozinhas,
// sem atrapalhar quem está digitando ou com uma janela aberta.

let timerAoVivo;
async function atualizarAoVivo() {
  const campo = document.activeElement;
  if (!telaAtual?.aoVivo || $(".modal-fundo") || (campo && /^(INPUT|TEXTAREA|SELECT)$/.test(campo.tagName))) return;
  const meu = numeroRender;
  const y = window.scrollY;
  try {
    await carregarTudo();
    if (meu !== numeroRender) return; // mudou de tela enquanto carregava
    await telaAtual.fn();
    window.scrollTo(0, y);
  } catch (err) {
    console.error(err);
  }
}

function ouvirMudancas() {
  if (!sb) return;
  sb.channel("mudancas")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      clearTimeout(timerAoVivo);
      timerAoVivo = setTimeout(atualizarAoVivo, 1200);
    })
    .subscribe();
}

$("#abrir-ia").onclick = abrirAssistente;
for (const el of document.querySelectorAll("[data-ico]")) el.outerHTML = ico(el.dataset.ico, +el.dataset.tam || 22);
window.addEventListener("hashchange", rotear);
rotear();
ouvirMudancas();

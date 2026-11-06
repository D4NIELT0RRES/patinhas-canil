// Navegação entre telas (pelo # da URL) e inicialização.

const ROTAS = [
  [/^#\/animais$/, () => viewLista(), "animais"],
  [/^#\/animal\/novo$/, () => viewForm(null), "animais"],
  [/^#\/animal\/([^/]+)\/editar$/, (id) => viewForm(id), "animais"],
  [/^#\/animal\/([^/]+)(?:\/(saude))?$/, (id, aba) => viewFicha(id, aba), "animais"],
  [/^#\/vacinas$/, () => viewVacinas(), "vacinas"],
  [/^#\/canis$/, () => viewCanis(), "canis"],
  [/^#\/pendencias$/, () => viewPendencias(), "pendencias"],
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
async function rotear() {
  const hash = location.hash || "#/animais";
  const rota = ROTAS.map(([re, fn, menu]) => [hash.match(re), fn, menu]).find(([m]) => m);
  if (!rota) {
    location.hash = "#/animais";
    return;
  }
  const [m, fn, menu] = rota;
  for (const l of document.querySelectorAll("nav a")) l.classList.toggle("ativo", l.dataset.menu === menu);
  if (!sb) return telaConfiguracao();

  const meu = ++numeroRender;
  $("#app").innerHTML = `<div class="carregando"><div class="roda"></div><p>Carregando...</p></div>`;
  try {
    await carregarTudo();
    if (meu !== numeroRender) return; // o usuário já foi para outra tela
    await fn(...m.slice(1));
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    if (meu === numeroRender) mostrarErro("Não foi possível carregar os dados. Verifique a internet.", rotear);
  }
}

for (const el of document.querySelectorAll("[data-ico]")) el.outerHTML = ico(el.dataset.ico, +el.dataset.tam || 22);
window.addEventListener("hashchange", rotear);
rotear();

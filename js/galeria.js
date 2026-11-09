// Galeria: carrossel de fotos dos animais. Tocar na foto abre o cartão com os dados.

let timerGaleria;
const filtroGaleria = { grupo: "todos" };

const GRUPOS_GALERIA = [
  ["todos", "Todos"],
  ["disponivel", "Para adoção"],
  ["cachorro", "Cachorros"],
  ["gato", "Gatos"],
];

function animaisDaGaleria() {
  const g = filtroGaleria.grupo;
  return Store.animais
    .filter((a) => a.foto_url && a.status !== "adotado")
    .filter((a) => g === "todos" || (g === "disponivel" ? a.status === "disponivel" : a.especie === g))
    .sort((x, y) => (y.status === "disponivel") - (x.status === "disponivel") || x.nome.localeCompare(y.nome, "pt-BR"));
}

// Cartão com os dados do animal; as setas passam para o próximo da galeria.
function abrirCartaoAnimal(lista, posicao) {
  let i = posicao;
  const { el, fechar } = abrirModal(`<div id="cartao"></div>`, null, "modal-cartao");
  const desenhar = () => {
    const a = lista[i];
    const r = resumoVacinas(a);
    const vacina = r.pendentes.length
      ? `<span class="pilula vac-falta">${r.pendentes.length} ${r.pendentes.length === 1 ? "vacina pendente" : "vacinas pendentes"}</span>`
      : `<span class="pilula vac-ok">Vacinas em dia</span>`;
    const fatos = [
      ROTULOS.especie[a.especie],
      ROTULOS.sexo[a.sexo],
      a.raca,
      a.cor,
      ROTULOS.porte[a.porte],
      a.data_nascimento && fmtDuracao(mesesDesde(a.data_nascimento)),
      a.castrado && "Castrado",
    ].filter(Boolean);
    $("#cartao", el).innerHTML = `
      <div class="cartao-foto"><img src="${esc(a.foto_url)}" alt="Foto de ${esc(a.nome)}">
        <button class="cartao-x icone-btn" data-fechar aria-label="Fechar">${ico("x", 20)}</button>
        ${lista.length > 1 ? `<button class="seta seta-esq" data-ant aria-label="Anterior">${ico("voltar", 22)}</button><button class="seta seta-dir" data-prox aria-label="Próximo">${ico("voltar", 22)}</button>` : ""}
      </div>
      <div class="cartao-corpo">
        <div class="linha-nome"><h2>${esc(a.nome)}</h2><span class="pilula st-${a.status}">${ROTULOS.status[a.status]}</span></div>
        <div class="fatos">${fatos.map((f) => `<span class="fato">${esc(f)}</span>`).join("")}</div>
        <div class="cartao-linha">${vacina}<span class="cartao-canil">${ico("home", 18)} ${esc(nomeCanil(a))}</span></div>
        ${a.observacoes ? `<p class="cartao-obs">${esc(a.observacoes)}</p>` : ""}
        <p class="cartao-pos">${i + 1} de ${lista.length}</p>
        <a class="btn" href="#/animal/${a.id}" data-ficha>Ver ficha completa</a>
      </div>`;
    $("[data-fechar]", el).onclick = fechar;
    $("[data-ficha]", el).onclick = fechar;
    const ir = (d) => { i = (i + d + lista.length) % lista.length; desenhar(); };
    if (lista.length > 1) {
      $("[data-ant]", el).onclick = () => ir(-1);
      $("[data-prox]", el).onclick = () => ir(1);
    }
  };
  desenhar();
  // setas do teclado
  const tecla = (e) => {
    if (!document.body.contains(el)) return document.removeEventListener("keydown", tecla);
    if (e.key === "ArrowLeft") $("[data-ant]", el)?.click();
    if (e.key === "ArrowRight") $("[data-prox]", el)?.click();
  };
  document.addEventListener("keydown", tecla);
}

async function viewGaleria() {
  clearInterval(timerGaleria);
  const lista = animaisDaGaleria();
  const semFoto = Store.animais.filter((a) => !a.foto_url && a.status !== "adotado").length;

  const filtros = GRUPOS_GALERIA.map(
    ([v, r]) => `<button class="chip-filtro ${filtroGaleria.grupo === v ? "ativo" : ""}" data-grupo="${v}">${r}</button>`
  ).join("");

  $("#app").innerHTML = `
    <h1>Galeria</h1>
    <p class="subtitulo-tela">Toque em uma foto para conhecer o animal.</p>
    <div class="chips-filtro">${filtros}</div>
    ${
      lista.length
        ? `<div class="carrossel">
             <div class="trilho" id="trilho" tabindex="0" aria-label="Fotos dos animais">
               ${lista.map((a, n) => `<button class="slide" data-n="${n}" aria-label="Abrir ${esc(a.nome)}">
                 <img src="${esc(a.foto_url)}" alt="Foto de ${esc(a.nome)}" loading="${n < 3 ? "eager" : "lazy"}" draggable="false">
                 <span class="slide-nome"><strong>${esc(a.nome)}</strong><small>${esc([a.raca, a.data_nascimento && fmtDuracao(mesesDesde(a.data_nascimento))].filter(Boolean).join(" · "))}</small></span>
                 ${a.status === "disponivel" ? `<span class="selo selo-adocao">Para adoção</span>` : ""}
               </button>`).join("")}
             </div>
             ${lista.length > 1 ? `<button class="seta seta-esq" id="gal-ant" aria-label="Anterior">${ico("voltar", 24)}</button><button class="seta seta-dir" id="gal-prox" aria-label="Próximo">${ico("voltar", 24)}</button>` : ""}
           </div>
           <div class="miniaturas" id="minis">${lista.map((a, n) => `<button class="mini ${n === 0 ? "ativa" : ""}" data-n="${n}" aria-label="Ir para ${esc(a.nome)}"><img src="${esc(a.foto_url)}" alt="" loading="lazy" draggable="false"></button>`).join("")}</div>`
        : `<div class="vazio"><p>Ainda não há fotos${filtroGaleria.grupo === "todos" ? "" : " neste grupo"}.</p><a class="btn" href="#/animais">Ver os animais</a></div>`
    }
    ${semFoto ? `<p class="galeria-nota">${ico("camera", 18)} ${semFoto} ${semFoto === 1 ? "animal ainda está sem foto" : "animais ainda estão sem foto"}.</p>` : ""}`;

  for (const b of document.querySelectorAll("[data-grupo]")) {
    b.onclick = () => { filtroGaleria.grupo = b.dataset.grupo; viewGaleria(); };
  }
  if (!lista.length) return;

  const trilho = $("#trilho");
  const slides = [...trilho.querySelectorAll(".slide")];
  const minis = [...document.querySelectorAll(".mini")];
  const atual = () => {
    const meio = trilho.scrollLeft + trilho.clientWidth / 2;
    return slides.reduce((m, s, n) => (Math.abs(s.offsetLeft + s.offsetWidth / 2 - meio) < Math.abs(slides[m].offsetLeft + slides[m].offsetWidth / 2 - meio) ? n : m), 0);
  };
  const ir = (n) => {
    const s = slides[(n + slides.length) % slides.length];
    trilho.scrollTo({ left: s.offsetLeft - (trilho.clientWidth - s.offsetWidth) / 2, behavior: "smooth" });
  };
  let marcada = 0;
  trilho.addEventListener("scroll", () => {
    const n = atual();
    if (n === marcada) return;
    marcada = n;
    minis.forEach((m, k) => m.classList.toggle("ativa", k === n));
    minis[n].scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, { passive: true });

  slides.forEach((s, n) => (s.onclick = () => abrirCartaoAnimal(lista, n)));
  minis.forEach((m, n) => (m.onclick = () => ir(n)));
  $("#gal-ant") && ($("#gal-ant").onclick = () => ir(atual() - 1));
  $("#gal-prox") && ($("#gal-prox").onclick = () => ir(atual() + 1));
  trilho.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") ir(atual() - 1);
    if (e.key === "ArrowRight") ir(atual() + 1);
  });

  // passa sozinho a cada 5 s; pausa ao tocar, com a janela aberta ou se o usuário prefere menos movimento
  const parar = window.matchMedia("(prefers-reduced-motion: reduce)").matches || lista.length < 2;
  let pausado = false;
  for (const ev of ["pointerdown", "mouseenter", "focusin"]) trilho.addEventListener(ev, () => (pausado = true));
  for (const ev of ["mouseleave", "focusout"]) trilho.addEventListener(ev, () => (pausado = false));
  if (!parar) {
    timerGaleria = setInterval(() => {
      if (!document.body.contains(trilho)) return clearInterval(timerGaleria);
      if (!pausado && !$(".modal-fundo") && !document.hidden) ir(atual() + 1);
    }, 5000);
  }
}

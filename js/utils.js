// Funções de apoio: textos, datas, avisos e janelas (modais).

const $ = (sel, raiz = document) => raiz.querySelector(sel);

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// minúsculas e sem acentos, para a busca
const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const ROTULOS = {
  especie: { cachorro: "Cachorro", gato: "Gato", ambos: "Cachorro e gato" },
  sexo: { macho: "Macho", femea: "Fêmea" },
  porte: { pequeno: "Pequeno", medio: "Médio", grande: "Grande" },
  status: {
    disponivel: "Disponível para adoção",
    tratamento: "Em tratamento",
    quarentena: "Quarentena",
    lar_temporario: "Lar temporário",
    adotado: "Adotado",
  },
  vacina: { ok: "Em dia", vencida: "Vencida", falta: "Falta" },
};

// ---------- Ícones (traço simples, herdam a cor do texto) ----------

const ICONES = {
  paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
  syringe: '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3a1 1 0 0 1-1.4 0L4.7 16.7a1 1 0 0 1 0-1.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  voltar: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  nota: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  grade: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  print: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
};
const ico = (nome, tam = 20) =>
  `<svg class="ico" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[nome]}</svg>`;

// ---------- Datas (sempre no fuso local, no formato AAAA-MM-DD) ----------

const toISO = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hojeISO = () => toISO(new Date());
const parseISO = (s) => {
  const [a, m, d] = s.split("-").map(Number);
  return new Date(a, m - 1, d);
};
// dias de a até b (positivo quando b é depois de a)
const diasEntre = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const addDias = (iso, n) => {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const fmtData = (iso) => (iso ? parseISO(iso).toLocaleDateString("pt-BR") : "—");

// meses completos entre a data e hoje
function mesesDesde(iso, hoje = new Date()) {
  if (!iso) return null;
  const d = parseISO(iso);
  let m = (hoje.getFullYear() - d.getFullYear()) * 12 + hoje.getMonth() - d.getMonth();
  if (hoje.getDate() < d.getDate()) m--;
  return Math.max(m, 0);
}

// 27 -> "2 anos e 3 meses"
function fmtDuracao(meses) {
  if (meses == null) return "—";
  if (meses < 1) return "menos de 1 mês";
  const a = Math.floor(meses / 12);
  const m = meses % 12;
  const pa = a ? `${a} ${a === 1 ? "ano" : "anos"}` : "";
  const pm = m ? `${m} ${m === 1 ? "mês" : "meses"}` : "";
  return pa && pm ? `${pa} e ${pm}` : pa || pm;
}

// ---------- Aviso rápido ----------

let timerAviso;
function aviso(texto, tipo = "ok") {
  let el = $("#aviso");
  if (!el) {
    el = document.createElement("div");
    el.id = "aviso";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  el.className = `aviso aviso-${tipo} visivel`;
  el.innerHTML = `${ico(tipo === "erro" ? "alert" : "check", 18)}<span>${esc(texto)}</span>`;
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => el.classList.remove("visivel"), 3500);
}

// ---------- Janelas ----------

function abrirModal(html, aoFechar, classe = "") {
  const fundo = document.createElement("div");
  fundo.className = "modal-fundo";
  fundo.innerHTML = `<div class="modal ${classe}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(fundo);
  document.body.classList.add("sem-rolagem");
  const fechar = () => {
    fundo.remove();
    if (!$(".modal-fundo")) document.body.classList.remove("sem-rolagem");
    aoFechar?.();
  };
  fundo.addEventListener("click", (e) => e.target === fundo && fechar());
  fundo.addEventListener("keydown", (e) => e.key === "Escape" && fechar());
  return { el: fundo.firstElementChild, fechar };
}

// Pergunta "tem certeza?". Resolve true/false.
function confirmar({ titulo, texto, botao = "Confirmar", perigo = false }) {
  return new Promise((resolve) => {
    let resposta = false;
    const { el, fechar } = abrirModal(
      `<h2>${esc(titulo)}</h2><p>${esc(texto)}</p>
       <div class="modal-botoes">
         <button class="btn btn-contorno" data-nao>Cancelar</button>
         <button class="btn ${perigo ? "btn-perigo" : ""}" data-sim>${esc(botao)}</button>
       </div>`,
      () => resolve(resposta)
    );
    $("[data-nao]", el).onclick = fechar;
    $("[data-sim]", el).onclick = () => {
      resposta = true;
      fechar();
    };
    $("[data-nao]", el).focus();
  });
}

// Janela com formulário simples. campos: [{nome, rotulo, ajuda, tipo, valor, opcoes, obrigatorio, min, max}]
// Resolve com um objeto {nome: valor} ou null se cancelar.
function formularioModal({ titulo, texto = "", campos, botao = "Salvar" }) {
  return new Promise((resolve) => {
    let resultado = null;
    const html = campos
      .map((c) => {
        const base = `id="m_${c.nome}" name="${c.nome}" ${c.obrigatorio ? "required" : ""}`;
        let campo;
        if (c.tipo === "select") {
          campo = `<select ${base}>${c.opcoes
            .map(([v, r]) => `<option value="${esc(v)}" ${v === c.valor ? "selected" : ""}>${esc(r)}</option>`)
            .join("")}</select>`;
        } else {
          campo = `<input ${base} type="${c.tipo || "text"}" value="${esc(c.valor ?? "")}"
                    ${c.min != null ? `min="${c.min}"` : ""} ${c.max != null ? `max="${c.max}"` : ""}
                    ${c.tipo === "number" ? 'inputmode="numeric"' : ""} autocomplete="off">`;
        }
        return `<div class="campo"><label for="m_${c.nome}">${esc(c.rotulo)}</label>${campo}
                ${c.ajuda ? `<p class="ajuda">${esc(c.ajuda)}</p>` : ""}</div>`;
      })
      .join("");
    const { el, fechar } = abrirModal(
      `<h2>${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ""}
       <form>${html}
         <div class="modal-botoes">
           <button type="button" class="btn btn-contorno" data-nao>Cancelar</button>
           <button type="submit" class="btn">${esc(botao)}</button>
         </div></form>`,
      () => resolve(resultado)
    );
    $("[data-nao]", el).onclick = fechar;
    $("form", el).onsubmit = (e) => {
      e.preventDefault();
      resultado = Object.fromEntries(new FormData(e.target));
      fechar();
    };
    el.querySelector("input,select")?.focus();
  });
}

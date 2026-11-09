// Recursos de IA: assistente (chat), texto de adoção e leitura da foto.
// O navegador só fala com /api/assistente; a chave da IA fica no servidor.

// ---------- Guia fixo (funciona mesmo sem a IA) ----------

const GUIA_ALIMENTOS = {
  cachorro: {
    pode: ["Cenoura", "Maçã (sem sementes)", "Banana (pouca)", "Melancia (sem sementes e sem casca)", "Abóbora cozida", "Batata-doce cozida", "Arroz cozido", "Frango cozido, sem tempero e sem osso", "Ovo cozido", "Pepino"],
    naoPode: ["Chocolate e cacau", "Uva e uva-passa", "Cebola e alho", "Abacate", "Macadâmia e nozes", "Café e chá preto", "Álcool", "Xilitol (adoçante de chicletes e balas)", "Ossos cozidos ou de frango (lascam)", "Massa de pão crua", "Comida temperada, frita ou muito salgada", "Doces e leite de vaca em quantidade"],
  },
  gato: {
    pode: ["Frango cozido, sem tempero e sem osso", "Peixe cozido, sem espinhas (pouco)", "Ovo cozido", "Abóbora cozida", "Melancia em pedacinhos (sem sementes)", "Grama de gato"],
    naoPode: ["Cebola e alho", "Chocolate e cacau", "Uva e uva-passa", "Leite de vaca (muitos gatos passam mal)", "Atum temperado e peixe cru", "Café e chá preto", "Álcool", "Massa de pão crua", "Ossos cozidos", "Ração de cachorro como refeição", "Lírios e outras plantas tóxicas", "Comida temperada, frita ou salgada"],
  },
};

const guiaHTML = (especie) => {
  const g = GUIA_ALIMENTOS[especie];
  const lista = (itens) => `<ul>${itens.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
  return `<div class="guia-colunas">
      <div class="guia-pode"><h4>${ico("check", 16)} Pode (com moderação)</h4>${lista(g.pode)}</div>
      <div class="guia-nao"><h4>${ico("x", 16)} Não pode</h4>${lista(g.naoPode)}</div>
    </div>
    <p class="ajuda">Se o animal comeu algo da lista “não pode”, ligue para um veterinário na hora, sem esperar sintomas.</p>`;
};

// ---------- Conversa com o servidor ----------

async function chamarIA(corpo) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const r = await fetch("/api/assistente", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
      signal: ctrl.signal,
    });
    let dados = {};
    try {
      dados = await r.json();
    } catch {}
    if (!r.ok) {
      const e = new Error(dados.mensagem || "O assistente não respondeu.");
      e.codigo = dados.erro;
      e.status = r.status;
      throw e;
    }
    return dados;
  } finally {
    clearTimeout(timer);
  }
}

function mensagemErroIA(e) {
  if (e.codigo === "nao_configurado") return "O assistente ainda não foi ativado. Peça ao administrador do app para ativá-lo (o passo a passo está no README). O guia de alimentos acima funciona normalmente.";
  if (e.status === 404 || e.status === 405) return "O assistente só funciona no site publicado, não nesta cópia local.";
  if (e.name === "AbortError") return "A resposta demorou demais. Tente de novo.";
  if (e instanceof TypeError) return "Sem conexão com a internet. Tente de novo.";
  return e.message || "O assistente não respondeu. Tente de novo.";
}

// Dados do animal enviados à IA para personalizar a resposta
function contextoAnimal(a) {
  const r = resumoVacinas(a);
  return {
    nome: a.nome,
    especie: ROTULOS.especie[a.especie],
    sexo: ROTULOS.sexo[a.sexo],
    raca: a.raca,
    cor: a.cor,
    porte: ROTULOS.porte[a.porte],
    castrado: a.castrado ? "sim" : "não",
    idade: fmtDuracao(mesesDesde(a.data_nascimento)),
    tempoNaONG: fmtDuracao(mesesDesde(a.data_entrada)),
    status: ROTULOS.status[a.status],
    doencas: a.doencas,
    limitacoes: a.limitacoes,
    observacoes: a.observacoes,
    vacinas: r.itens.map((i) => ({ nome: i.vacina.nome, situacao: ROTULOS.vacina[i.status].toLowerCase(), proxima: i.proxima ? fmtData(i.proxima) : "" })),
  };
}

// Texto simples da IA -> HTML seguro (listas com "- " e **negrito**)
function formatarResposta(texto) {
  const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  let html = "";
  let emLista = false;
  for (const linha of esc(texto).split("\n")) {
    const item = linha.match(/^\s*[-•*]\s+(.*)$/);
    if (item) {
      if (!emLista) html += "<ul>";
      emLista = true;
      html += `<li>${inline(item[1])}</li>`;
    } else {
      if (emLista) html += "</ul>";
      emLista = false;
      if (linha.trim()) html += `<p>${inline(linha)}</p>`;
    }
  }
  return html + (emLista ? "</ul>" : "");
}

// ---------- Chat ----------

const SUGESTOES_GERAIS = ["Cachorro pode comer banana?", "Gato pode tomar leite?", "Quais sinais mostram que o animal precisa de veterinário?", "Como dar banho em filhote?"];
const sugestoesDoAnimal = (n) => [`O que ${n} pode e não pode comer?`, `Que cuidados ${n} precisa por causa da saúde?`, `Quanto de ração por dia para ${n}?`, `Como acalmar ${n} no canil?`];

const estadoGeral = { msgs: [], pensando: false };

// Monta o chat dentro de `raiz`. `estado` guarda a conversa para ela não se perder ao trocar de aba.
function montarChat(raiz, { animal = null, estado = { msgs: [], pensando: false } } = {}) {
  const sugestoes = animal ? sugestoesDoAnimal(animal.nome) : SUGESTOES_GERAIS;
  const especieGuia = animal?.especie === "gato" ? "gato" : "cachorro";
  raiz.innerHTML = `
    <div class="chat">
      <p class="chat-aviso">${ico("alert", 18)} A IA dá dicas gerais e pode errar. Ela não substitui o veterinário. Em emergência, procure um veterinário.</p>
      <details class="guia">
        <summary>Guia rápido: o que pode e não pode comer</summary>
        <div class="seg guia-seg" role="group" aria-label="Espécie">
          <button type="button" class="${especieGuia === "cachorro" ? "ativo" : ""}" data-guia="cachorro">Cachorro</button>
          <button type="button" class="${especieGuia === "gato" ? "ativo" : ""}" data-guia="gato">Gato</button>
        </div>
        <div class="guia-corpo">${guiaHTML(especieGuia)}</div>
      </details>
      <div class="chat-msgs" aria-live="polite"></div>
      <div class="sugestoes">${sugestoes.map((s) => `<button type="button" class="chip-sugestao">${esc(s)}</button>`).join("")}</div>
      <form class="chat-form">
        <textarea rows="1" maxlength="1000" placeholder="${animal ? `Pergunte sobre ${esc(animal.nome)}...` : "Pergunte sobre alimentação, saúde, cuidados..."}" aria-label="Sua pergunta"></textarea>
        <button class="btn" type="submit" aria-label="Enviar">${ico("send", 22)}</button>
      </form>
    </div>`;

  const caixa = $(".chat-msgs", raiz);
  const campo = $("textarea", raiz);
  const boasVindas = `<div class="chat-vazio">${ico("chat", 36)}<p><strong>${animal ? `Dúvidas sobre ${esc(animal.nome)}?` : "Como posso ajudar?"}</strong></p><p>${animal ? "Eu já conheço os dados e as vacinas dele(a). " : ""}Toque numa sugestão ou escreva sua pergunta.</p></div>`;

  const desenhar = () => {
    caixa.innerHTML =
      (estado.msgs.length
        ? estado.msgs.map((m) => `<div class="bolha bolha-${m.role}${m.erro ? " bolha-erro" : ""}">${m.role === "user" ? esc(m.content).replace(/\n/g, "<br>") : m.erro ? esc(m.content) : formatarResposta(m.content)}</div>`).join("")
        : boasVindas) + (estado.pensando ? `<div class="bolha bolha-assistant"><span class="digitando"><i></i><i></i><i></i></span></div>` : "");
    caixa.scrollTop = caixa.scrollHeight;
    $(".sugestoes", raiz).hidden = estado.msgs.length > 0;
  };

  async function enviar(texto) {
    texto = texto.trim();
    if (!texto || estado.pensando) return;
    estado.msgs.push({ role: "user", content: texto });
    estado.pensando = true;
    campo.value = "";
    desenhar();
    try {
      const r = await chamarIA({
        modo: "chat",
        animal: animal ? contextoAnimal(animal) : undefined,
        mensagens: estado.msgs.filter((m) => !m.erro).slice(-10),
      });
      estado.msgs.push({ role: "assistant", content: r.texto || "Não consegui responder. Tente de novo." });
    } catch (e) {
      console.error(e);
      estado.msgs.push({ role: "assistant", content: mensagemErroIA(e), erro: true });
    }
    estado.pensando = false;
    desenhar();
  }

  $(".chat-form", raiz).onsubmit = (e) => {
    e.preventDefault();
    enviar(campo.value);
  };
  campo.onkeydown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(campo.value);
    }
  };
  raiz.onclick = (e) => {
    const sug = e.target.closest(".chip-sugestao");
    if (sug) return enviar(sug.textContent);
    const g = e.target.closest("[data-guia]");
    if (g) {
      for (const b of raiz.querySelectorAll("[data-guia]")) b.classList.toggle("ativo", b === g);
      $(".guia-corpo", raiz).innerHTML = guiaHTML(g.dataset.guia);
    }
  };
  desenhar();
}

// Botão do topo: assistente geral, em janela
function abrirAssistente() {
  const { el, fechar } = abrirModal(
    `<div class="modal-topo"><h2>${ico("chat", 22)} Assistente</h2><button class="icone-btn" data-fechar aria-label="Fechar">${ico("x", 20)}</button></div><div id="chat-geral"></div>`,
    null,
    "modal-chat"
  );
  $("[data-fechar]", el).onclick = fechar;
  montarChat($("#chat-geral", el), { estado: estadoGeral });
}

// ---------- Texto de adoção ----------

async function abrirTextoAdocao(a) {
  const { el, fechar } = abrirModal(
    `<h2>${ico("nota", 22)} Texto de adoção</h2><div class="carregando"><div class="roda"></div><p>Escrevendo o texto de ${esc(a.nome)}...</p></div>`,
    null,
    "modal-larga"
  );
  try {
    const r = await chamarIA({ modo: "adocao", animal: contextoAnimal(a) });
    el.innerHTML = `<h2>${ico("nota", 22)} Texto de adoção</h2>
      <p class="ajuda">Criado por IA com os dados de ${esc(a.nome)}. Leia e ajuste antes de publicar.</p>
      <textarea class="texto-adocao" rows="9" aria-label="Texto de adoção">${esc(r.texto || "")}</textarea>
      <div class="modal-botoes modal-botoes-col">
        <button class="btn" data-copiar>${ico("copy")} Copiar texto</button>
        <button class="btn btn-suave" data-zap>${ico("send")} Enviar no WhatsApp</button>
        <button class="btn btn-contorno" data-fechar>Fechar</button>
      </div>`;
    const texto = () => $(".texto-adocao", el).value;
    $("[data-fechar]", el).onclick = fechar;
    $("[data-copiar]", el).onclick = async () => {
      try {
        await navigator.clipboard.writeText(texto());
        aviso("Texto copiado!");
      } catch {
        $(".texto-adocao", el).select();
        aviso("Toque e segure no texto para copiar.", "erro");
      }
    };
    $("[data-zap]", el).onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(texto())}`, "_blank", "noopener");
  } catch (e) {
    console.error(e);
    el.innerHTML = `<h2>Texto de adoção</h2><p class="erro">${esc(mensagemErroIA(e))}</p><div class="modal-botoes"><button class="btn btn-contorno" data-fechar>Fechar</button></div>`;
    $("[data-fechar]", el).onclick = fechar;
  }
}

// ---------- Leitura da foto ----------

const blobParaBase64 = (blob) =>
  new Promise((ok, falha) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result).split(",")[1]);
    leitor.onerror = falha;
    leitor.readAsDataURL(blob);
  });

// Devolve {especie, raca, cor, porte, confianca} sugeridos pela IA a partir da foto
async function sugerirPelaFoto(arquivo) {
  const blob = await comprimirImagem(arquivo, 800);
  const r = await chamarIA({ modo: "foto", imagem: { tipo: blob.type || "image/jpeg", dados: await blobParaBase64(blob) } });
  return r.sugestao;
}
